// SPDX-License-Identifier: Apache-2.0
import { View, div } from "gpui-kit";
import { h_flex, v_flex, Input, InputState, ScrollHandle } from "gpui-base";
import { appHome, checking, closeOverlay, exec, home, panes, props, readTextFile, run, spaces, theme } from "herdr";

async function git(cwd, on, args, timeout) {
  const r = await exec("git", args, { cwd, on, ...(timeout === undefined ? {} : { timeout }) });
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Git command failed.");
  return r.stdout.trim();
}

async function worktreeRoot(on) {
  const raw = await readTextFile(`${appHome()}/settings.json`);
  const setting = (raw === null ? null : JSON.parse(raw))?.worktrees?.directory ?? "~/.herdr/worktrees";
  if (typeof setting !== "string" || !setting.trim()) throw new Error("worktrees.directory must be a non-empty path.");
  let path = setting.replace(/\\/g, "/");
  if (path === "~" || path.startsWith("~/")) {
    let userHome = on ? "" : home();
    if (on) {
      const shell = await exec("sh", ["-c", 'printf %s "$HOME"'], { on }).catch(() => null);
      userHome = shell?.code === 0 ? shell.stdout.trim() : "";
      if (!userHome) {
        const ps = await exec("powershell.exe", ["-NoProfile", "-Command", "[Console]::Write($HOME)"], { on });
        if (ps.code === 0) userHome = ps.stdout.trim();
      }
    }
    if (!userHome) throw new Error("Could not find the machine’s home folder.");
    path = userHome.replace(/\\/g, "/").replace(/\/$/, "") + path.slice(1);
  }
  if (!/^(?:\/|[A-Za-z]:\/)/.test(path)) throw new Error("worktrees.directory must be absolute or start with ~/.");
  return path.replace(/\/+$/, "");
}

// Match the shipped New worktree folder convention, including Unicode names.
function slug(branch) {
  const normalized = branch.normalize("NFC");
  const name = normalized.replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  if (name) return name;
  let hash = 2166136261;
  for (const char of normalized) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return `branch-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const errorText = e => e.message || String(e);

export default class WorktreeFromBranch extends View {
  init(_props, cx) {
    this.existing = props()?.mode === "existing";
    this.filter = InputState.new({ placeholder: this.existing ? "Filter local branches" : "Filter local and remote branches" });
    if (!this.existing) this.name = InputState.new({ placeholder: "New branch name" });
    this.scroll = ScrollHandle.new();
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.refs = null;
    this.selected = null;
    this.at = 0;
    this.filterFocused = false;
    this.busy = false;
    this.error = "";
    this.filter.on("change", (_, cx) => {
      this.at = 0;
      this.scroll.scroll_to_item(0);
      cx.notify();
    });
    this.filter.on("focus", (_, cx) => { this.filterFocused = true; cx.notify(); });
    this.filter.on("blur", (_, cx) => { this.filterFocused = false; cx.notify(); });
    this.filter.on("submit", (_, cx) => this.choose(this.matches()[this.at], cx));
    this.name?.on("change", (_, cx) => { this.error = ""; cx.notify(); });
    this.name?.on("submit", (_, cx) => this.create(cx));
    if (checking()) return;
    cx.spawn(async cx => {
      try {
        const space = spaces().find(s => s.id === props()?.space);
        if (!space) throw new Error("The source workspace is no longer open.");
        const tabs = new Set(space.tabs.map(t => t.id));
        const cwd = panes().find(p => tabs.has(p.tab) && p.cwd)?.cwd || space.folder;
        if (!cwd) throw new Error("The source workspace has no checkout directory.");
        this.cwd = cwd;
        this.on = space.machine ?? null;
        const [refs, common, root] = await Promise.all([
          git(cwd, this.on, ["for-each-ref", "--format=%(refname)%09%(symref)%09%(if)%(worktreepath)%(then)checked-out%(end)", "refs/heads", ...(this.existing ? [] : ["refs/remotes"])]),
          git(cwd, this.on, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
          worktreeRoot(this.on),
        ]);
        this.destination = `${root}/${common.replace(/\/\.git$/, "").split("/").pop()}`;
        this.refs = refs.split("\n").flatMap(line => {
          const [ref, symbolic, occupied] = line.split("\t");
          const match = /^refs\/(heads|remotes)\/(.+)$/.exec(ref);
          return match && !symbolic ? [{ ref, name: match[2], remote: match[1] === "remotes", occupied: occupied === "checked-out" }] : [];
        });
        cx.notify();
        cx.timer.after(100, () => this.filter.focus());
      } catch (e) { this.error = errorText(e); cx.notify(); }
    });
  }

  matches() {
    const query = this.filter.value().trim().toLowerCase();
    return (this.refs ?? []).filter(r => r.name.toLowerCase().includes(query));
  }

  choose(branch, cx) {
    if (!branch || this.busy) return;
    this.selected = branch;
    this.error = "";
    this.name?.focus();
    cx.notify();
  }

  create(cx) {
    const selected = this.selected;
    if (!selected || this.busy || (this.existing && selected.occupied)) return;
    const branch = this.existing ? selected.name : this.name.value().trim();
    if (!branch) return;
    this.busy = true;
    this.error = "";
    cx.notify();
    cx.spawn(async cx => {
      const path = `${this.destination}/${slug(branch)}`;
      try {
        if (this.existing) {
          // Confirm the local ref still exists; otherwise Git can guess a remote and create a branch.
          await git(this.cwd, this.on, ["show-ref", "--verify", selected.ref]);
          await git(this.cwd, this.on, ["worktree", "add", "--", path, branch], 600_000);
        } else {
          await git(this.cwd, this.on, ["worktree", "add", "-b", branch, "--", path, selected.ref], 600_000);
        }
        run("space.new", { folder: path, machine: this.on ?? "" });
        closeOverlay(props().overlay);
      } catch (e) { this.error = errorText(e); }
      this.busy = false;
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const rows = this.matches();
    const occupied = this.existing && this.selected?.occupied;
    const ready = Boolean(this.selected && !occupied && (this.existing || this.name.value().trim()));
    const input = state => Input.new(state).h(32).px(9).rounded(6).border_1().border_color(t.input).bg(t.background).text_color(t.foreground);
    const button = (id, label, enabled, action) => h_flex().id(id).h(28).px(10).rounded(6).items_center()
      .text_color(enabled ? t.foreground : t.dim).bg(t.raised)
      .when(enabled, el => el.cursor_pointer().hover(s => s.bg(t.selected)).on_click(action)).child(label);
    return v_flex().id("worktree-from-branch").track_focus(this.handle).size_full().p(16).gap(9).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (!rows.length || !this.filterFocused || !["up", "down"].includes(e.key)) return;
        this.at = (this.at + (e.key === "down" ? 1 : rows.length - 1)) % rows.length;
        this.scroll.scroll_to_item(this.at);
        cx.stop_propagation();
        cx.notify();
      })
      .child(div().font_semibold().text_color(t.foreground).child(this.existing ? "Checkout existing branch" : "New branch and worktree"))
      .child(div().text_color(t.muted).child(this.existing ? "Create a worktree without creating a branch." : "Create a branch from the selected base, then open it in a new worktree."))
      .when(this.refs === null && !this.error, el => el.child(div().text_color(t.muted).child("Loading branches…")))
      .when(this.refs !== null, el => el
        .child(input(this.filter))
        .child(v_flex().id("base-branches").h(156).overflow_y_scrollbar().track_scroll(this.scroll)
          .children(rows.map((r, i) => h_flex().id(r.ref).h(26).px(9).flex_none().gap(8).items_center().rounded(5)
            .when(this.selected?.ref === r.ref || (i === this.at && this.filterFocused), row => row.bg(t.selected))
            .hover(s => s.bg(t.hover)).cursor_pointer().on_click((_, cx) => this.choose(r, cx))
            .child(div().flex_1().truncate().text_color(t.foreground).child(r.name))
            .child(div().text_size(11).text_color(t.muted).child(this.existing && r.occupied ? "Already checked out" : r.remote ? "Remote" : "Local"))))
          .when(!rows.length, list => list.child(div().p(8).text_color(t.muted).child("No matching branches."))))
        .child(div().truncate().text_color(t.muted).child(this.selected
          ? (this.existing ? `Branch: ${this.selected.name}` : `Base: ${this.selected.name}`)
          : this.existing ? "Select a local branch" : "Select the starting branch for the new branch"))
        .when(occupied, pane => pane.child(div().text_color(t.blocked).child("This branch is already checked out. Use Open worktree to open its checkout.")))
        .when(!this.existing, pane => pane.child(input(this.name))))
      .when(Boolean(this.error), el => el.child(div().max_h(44).overflow_y_scroll().text_size(12).text_color(t.blocked).child(this.error)))
      .child(div().flex_1().min_h(0))
      .child(h_flex().gap(8).justify_end()
        .child(button("cancel", "Cancel", !this.busy, () => closeOverlay(props().overlay)))
        .child(button("create", this.busy ? "Creating…" : this.existing ? "Create worktree" : "Create branch and worktree", ready && !this.busy, (_, cx) => this.create(cx))));
  }
}
