// SPDX-License-Identifier: Apache-2.0
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";

// A helper with its own pane belongs to that pane's space. A peek-only helper
// inherits the nearest ancestor agent's space instead of appearing twice.
export function projectAgents(agents, terminals, focused) {
  const members = new Map(agents.map(a => [a.address, a]));
  const live = new Map(terminals.filter(t => t.state === "live").map(t => [t.address, t]));
  const all = [...agents];
  for (const t of live.values()) {
    if (members.has(t.address) || !t.parent || !(t.status || t.program?.agent)) continue;
    let parent = t.parent;
    for (let left = live.size; parent && left > 0; left--) {
      const owner = members.get(parent);
      if (owner) {
        all.push({
          address: t.address, space: owner.space, space_name: owner.space_name, program: t.program,
          title: t.name || t.template || t.program?.name || t.address,
          status: t.status === "error" ? "blocked" : t.status || "idle",
          focused: t.address === focused,
        });
        break;
      }
      parent = live.get(parent)?.parent;
    }
  }
  return all;
}

const rank = { idle: 0, done: 1, working: 2, blocked: 3 };
const strongest = (a, b) => (rank[b] ?? 0) > (rank[a] ?? 0) ? b : a;

export function projectGroups(spaces, parents, agents) {
  const byId = new Map(spaces.map(s => [s.id, s]));
  const parentOf = new Map(parents);
  const buckets = new Map();
  for (const a of agents) {
    const bucket = buckets.get(a.space);
    if (bucket) bucket.push(a);
    else buckets.set(a.space, [a]);
  }
  const roots = new Map();
  for (const s of spaces) {
    if (!byId.has(parentOf.get(s.id))) roots.set(s.id, { ...s, spaces: [], count: 0 });
  }
  for (const s of spaces) {
    const rows = buckets.get(s.id);
    if (!rows) continue;
    const root = roots.get(parentOf.get(s.id)) ?? roots.get(s.id);
    if (!root) continue;
    let status, active = false;
    for (const a of rows) {
      status = strongest(status, a.status);
      active ||= a.focused;
    }
    const child = { id: s.id, name: s.name, agents: rows, count: rows.length, status, active };
    if (s.id === root.id) root.spaces.unshift(child);
    else root.spaces.push(child);
    root.count += child.count;
    root.status = strongest(root.status, status);
    root.active ||= active;
  }
  return [...roots.values()].filter(g => g.count);
}

export function projectRows(groups, folded, t, draw) {
  const header = (id, node, depth) => {
    const open = !folded.has(id);
    return h_flex().id(id).h(depth ? 25 : 29).pl(depth ? 22 : 8).pr(8)
      .gap(6).flex_none().items_center().rounded(6).cursor_pointer()
      .when(!open && node.active, el => el.bg(t.selected))
      .hover(s => s.bg(t.hover)).on_click((_, cx) => draw.toggle(id, cx))
      .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(10).flex_none().text_color(t.muted))
      .child(svg(`mods/workspace-chrome/${depth ? "branch" : "folder"}.svg`).size(13).flex_none().text_color(t.muted))
      .child(div().flex_1().min_w(0).truncate().font_medium().text_size(depth ? 11.5 : 12).text_color(depth ? t.muted : t.foreground).child(node.name))
      .when(Boolean(node.machine), el => el.child(div().max_w(72).truncate().text_size(10).text_color(t.dim).child(node.machine)))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(String(node.count)))
      .when(!open && Boolean(node.status), el => el.child(draw.status(node.status)));
  };
  const rows = [];
  for (const g of groups) {
    const id = `project-${g.id}`;
    rows.push(header(id, g, 0));
    if (folded.has(id)) continue;
    for (const s of g.spaces) {
      const worktree = s.id !== g.id;
      if (worktree) {
        const key = `project-worktree-${s.id}`;
        rows.push(header(key, s, 1));
        if (folded.has(key)) continue;
      }
      for (const a of s.agents) rows.push(draw.agent(a, worktree ? 43 : 28));
    }
  }
  return rows;
}
