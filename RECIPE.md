# Herdr Plus

The stock Herdr workspace with foldable worktrees, change and agent badges in Spaces, and Git line counts in the bottom bar.

![Herdr Plus](preview.png)

## What you see

The 268 px sidebar has the normal Herdr chrome, Spaces above Agents, and the normal footer. Top-level avatars align in one column; a chevron sits to their left only for projects with nested worktrees. Nested rows are 28 px high with an indented branch icon; parent rows are 30 px. Git details and badges sit at the right edge. On the right, the normal tabs, terminal panes, Files and Changes panels sit above a 28 px status bar. Added and deleted line counts use the theme’s green and red, just after the agent count. Both mods follow the active Herdr theme.
The machine name is followed by a compact CPU bar history and memory progress bar, each with its current percentage.

## How it behaves

- The chevron hides or reveals only its worktree rows and remembers the choice. Selecting a row, reordering by dragging, and opening the context menu still work. If a hidden worktree is active, the parent row is highlighted.
- A Git Space’s context menu separates **New branch and worktree…** (pick a local or fetched remote base, then name the new branch) from **Checkout existing branch…** (pick a local branch, no new branch name). Both open a new Space on the same machine. Use **Open worktree** if the branch already has a checkout. The stock `+` menu is unchanged.
- Expanded rows report only their own state. A folded parent shows a single amber square if any checkout in the group has uncommitted changes, and its highest-priority agent state across all tabs and panes: blocked (`!`), working (animated ring), then done (solid dot). Idle has no badge. The parent’s Git branch and ahead/behind counts never include children.
- The Agents sort menu adds **Grouped by project** next to **Priority** and **Grouped by space**. Projects and nested worktrees fold independently. Each agent has its own row, including agents in different panes of the same tab. Folded headers display a count and the strongest status. The project view remembers folds separately from Spaces.
- The status bar follows the focused terminal, including the directory scope. It hides counts when no tracked text lines have changed, or when there is no Git checkout.
- Usage follows the machine named in the status bar. The CPU history keeps 16 one-second snapshots, sampled every three seconds while the window is active. Memory shows the latest sample. Hover over either meter for logical core count, load averages, memory totals, home filesystem space and uptime.
- On macOS, the Herdr Dock icon shows a red count of unread blocked or finished agents. Focusing a terminal in the active window clears only that terminal’s alert. A new blocked or finished episode can count again; leaving the layout clears its badge.

## Built from

- `layouts/herdr-plus.json` clones the shipped `main` tree, replacing the `spaces`, `agents`, and `status` blocks. It uses the shipped `workspace-chrome`, `tabs`, `pane`, `files`, and `changes` mods; its settings thumbnail is `layouts/herdr-plus.svg`.
- `mods/spaces-agent-status` groups spaces by machine and Git common directory, uses `agents()` for live status, and stores fold state locally. It reuses the shipped branch, chevron, and spinner assets. Git metadata comes from read-only `exec("git", …)` calls where each checkout lives; `watchFolder()` refreshes local data. The inherited sidebar uses `hc` to list and manage machines.
- `mods/agents-plus` uses the worktree parent IDs published by Spaces, so the project view follows the same tree without extra Git commands. It keeps pinned agents in their workspace, focuses pane-backed agents on click, and peeks at sub-agents without panes.
- `mods/space-menu-plus` routes both actions to `mods/worktree-from-branch`. The picker reads refs on the target machine without fetching, then runs `git worktree add` with `-b` only when creating a new branch. Both modes honor `worktrees.directory`.
- `mods/workspace-git-status` uses `focused()` to run a read-only, directory-scoped `git diff --numstat` on the terminal’s machine. It updates on focus or directory change and polls every five seconds while the window is active. Neither mod adds external network calls.
- `host-usage.js` runs one read-only shell probe through `exec` on the displayed machine per sample. It uses `iostat` and `vm_stat` on macOS, `/proc` on Linux, and `df` for home filesystem space. No installer, background daemon, or external service is needed.
- The status bar also uses `agents()` and `focused()` to track attention by terminal address and state sequence, and calls `setBadge()` only when the count changes. Keep previously observed completions until the individual terminal gets focus, even if Herdr marks all visible splits idle on tab entry.

## Watch out

- A worktree is foldable only when its main checkout also has a Space. Worktrees on different machines never group together.
- The amber square includes untracked files; line counts exclude untracked files, binary changes, and changes outside the terminal’s directory. The status bar compares the working tree with `HEAD` (or an empty tree before the first commit), not two diff totals added together.
- Uses the desktop app’s JavaScript mod API, not the Herdr TUI. Reuses the shipped `workspace-chrome` assets; don’t copy the full app defaults into the package.
- Usage is shown only for macOS and Linux machines that return a complete CPU and memory sample. Switching machines clears the graph rather than mixing hosts.

## Done when

1. Fold a parent with a dirty worktree and a working agent elsewhere in the group. Only the parent remains visible, with the square and spinner. A blocked agent takes precedence. Expanding restores each row’s own badges.
2. Change tracked text in two sibling directories. Focus a terminal in one directory and verify the bar counts only its changes. Switch or revert the edits and verify the count updates.
3. `herdr-app check` passes for the custom mods, and `layout.switch` can switch between `main` and `herdr-plus`.
4. On macOS or Linux, the bar shows CPU and memory percentages beside the machine name. Hover for the host details; change machines and verify old samples do not carry over.
5. Create a new branch from a selected base, then create a separate worktree for an existing local branch. The latter leaves the list of branches unchanged and will not force-checkout an occupied branch.
6. Open agents in a project and two splits of a worktree. Project mode shows one row per agent, folds the project or worktree independently, and switches back to the other Agents views.
