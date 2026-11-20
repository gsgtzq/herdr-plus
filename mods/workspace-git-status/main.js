// SPDX-License-Identifier: Apache-2.0
// Modified for Herdr Plus from Herdr Desktop v0.1.16 (see NOTICE).

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, focused, exec, checking, theme, run, window, keys } from "herdr";

const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
// An unborn branch has no HEAD, so compare against Git's canonical empty tree.
const EMPTY_TREE = {
  sha1: "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
  sha256: "6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321",
};

async function diffTotals({ cwd, on }) {
  const git = (...args) => exec("git", [...READ, ...args], { cwd, on, timeout: 5000 });
  const diff = (base) => git("diff", "--numstat", "-z", "--no-ext-diff", "--no-textconv", base, "--", ".");
  let result = await diff("HEAD");
  if (result.code !== 0) {
    const head = await git("rev-parse", "--verify", "--quiet", "HEAD");
    if (head.code !== 1) return null;
    const format = await git("rev-parse", "--show-object-format");
    const base = EMPTY_TREE[format.stdout.trim()];
    if (format.code !== 0 || !base) return null;
    result = await diff(base);
    if (result.code !== 0) return null;
  }
  let add = 0, del = 0;
  // In -z mode a rename has two extra NUL-delimited paths after its counts.
  const fields = result.stdout.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const match = /^(\d+|-)\t(\d+|-)\t/.exec(fields[i]);
    if (!match) continue;
    if (match[1] !== "-") { add += Number(match[1]); del += Number(match[2]); }
    if (match[0].length === fields[i].length) i += 2;
  }
  return add || del ? { add, del } : null;
}

export default class WorkspaceStatus extends View {
  init(_props, cx) {
    this.target = null;
    this.totals = null;
    this.loading = false;
    if (!checking()) cx.timer.every(5000, cx => { if (window()?.active) this.refresh(cx); });
  }

  refresh(cx) {
    if (this.loading || !this.target || checking()) return;
    const target = this.target;
    this.loading = true;
    cx.spawn(async cx => {
      const totals = await diffTotals(target).catch(() => null);
      this.loading = false;
      if (this.target !== target) { this.refresh(cx); return; }
      if (totals?.add === this.totals?.add && totals?.del === this.totals?.del) return;
      this.totals = totals;
      cx.notify();
    });
  }

  followFocus(cx) {
    const f = focused();
    const terminal = f?.shown ?? f?.terminal;
    const cwd = terminal ? f.cwd || null : null;
    const slash = terminal?.indexOf("/") ?? -1;
    const on = slash < 0 ? null : terminal.slice(0, slash);
    if (cwd === (this.target?.cwd ?? null) && on === (this.target?.on ?? null)) return;
    this.target = cwd ? { cwd, on } : null;
    this.totals = null;
    this.refresh(cx);
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render(cx) {
    this.followFocus(cx);
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .when(Boolean(this.totals), el => el.child(h_flex().id("workspace-git-diff").gap(6).items_center().flex_none()
        .tooltip(`Added and deleted lines vs. HEAD in ${this.target.cwd} (tracked files)`)
        .child(div().text_color(t.ansi2).child(`+${this.totals.add}`))
        .child(div().text_color(t.ansi1).child(`-${this.totals.del}`))))
      .child(div().flex_1())
      .child(div().id("palette").text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t)));
  }
}
