// SPDX-License-Identifier: Apache-2.0
// Modified for Herdr Plus from Herdr Desktop v0.1.16 (see NOTICE).

// Space context menu. ↑/↓ move, Enter runs, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, spaces, panes, exec, checking } from "herdr";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

function items(id, git) {
  return [
    ["Rename", "space.rename", { id }],
    ...(git ? [
      ["New branch and worktree…", "worktree", { space: id, action: "new-branch" }],
      ["Checkout existing branch…", "worktree", { space: id, action: "existing" }],
      ["Open worktree", "worktree", { space: id, action: "open" }],
    ] : []),
    ...(git === "linked" ? [["Remove worktree", "worktree", { space: id, action: "remove" }]] : []),
    ["Close", "space.close", { id }],
  ];
}

function menuIcon(command) {
  const name = command === "space.close" ? "x" : command === "space.rename" ? "square-pen" : "git-branch";
  return `mods/workspace-chrome/${name}.svg`;
}

// The key bound to a command, for the hint on the right.
function shortcut(name) {
  const k = keys().find(b => b.section === "global" && b.action === name);
  return k ? k.keys : "";
}

export default class Menu extends View {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    if (checking()) return;
    const space = spaces().find(s => s.id === props()?.space);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  choose(i) {
    const it = items(props()?.space, this.git)[i];
    if (!it) return;
    closeOverlay(props()?.overlay);
    if (it[1] === "worktree") {
      const p = it[2];
      if (p.action === "new-branch" || p.action === "existing") {
        openOverlay({ mod: "worktree-from-branch", kind: "dialog", width: 480, height: 418, props: { space: p.space, mode: p.action } });
      } else openOverlay({ mod: "worktree", kind: "dialog", ...(p.action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: p });
    } else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(props()?.space, this.git);
    return v_flex()
      .id("menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(it[1] === "space.close", el => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(h_flex()
            .id(`mi-${i}`)
            .h(31)
            .px(8)
            .gap(9)
            .rounded(7)
            .items_center()
            .justify_between()
            .text_color(t.foreground)
            .when(i === this.at, (el) => el.bg(t.selected))
            .hover((s) => s.bg(t.hover))
            .on_click(() => this.choose(i))
            .child(svg(menuIcon(it[1])).size(14).flex_none().text_color(t.muted))
            .child(div().flex_1().child(it[0]))
            .child(div().text_size(11).text_color(t.dim).child(shortcut(it[1])))),
        ),
      );
  }
}
