# Herdr Plus

The stock Herdr workspace with foldable worktrees, change and agent badges in Spaces, and Git line counts in the bottom bar.

![Herdr Plus](preview.png)

## What you see

The 268 px sidebar has the normal Herdr chrome, Spaces above Agents, and the normal footer. Top-level avatars align in one column; a chevron sits to their left only for projects with nested worktrees. Nested rows are 28 px high with an indented branch icon; parent rows are 30 px. Git details and badges sit at the right edge. On the right, the normal tabs, terminal panes, Files and Changes panels sit above a 28 px status bar. Added and deleted line counts use the theme’s green and red, just after the agent count. Both mods follow the active Herdr theme.

## How it behaves

- The chevron hides or reveals only its worktree rows and remembers the choice. Selecting a row, reordering by dragging, and opening the context menu still work. If a hidden worktree is active, the parent row is highlighted.
- Expanded rows report only their own state. A folded parent shows a single amber square if any checkout in the group has uncommitted changes, and its highest-priority agent state across all tabs and panes: blocked (`!`), working (animated ring), then done (solid dot). Idle has no badge. The parent’s Git branch and ahead/behind counts never include children.
- The status bar follows the focused terminal, including the directory scope. It hides counts when no tracked text lines have changed, or when there is no Git checkout.

## Built from

- `layouts/herdr-plus.json` clones the shipped `main` tree, replacing the `spaces` and `status` blocks. It uses the shipped `workspace-chrome`, `agents`, `tabs`, `pane`, `files`, and `changes` mods; its settings thumbnail is `layouts/herdr-plus.svg`.
- `mods/spaces-agent-status` groups spaces by machine and Git common directory, uses `agents()` for live status, and stores fold state locally. It reuses the shipped branch, chevron, and spinner assets. Git metadata comes from read-only `exec("git", …)` calls where each checkout lives; `watchFolder()` refreshes local data. The inherited sidebar uses `hc` to list and manage machines.
- `mods/workspace-git-status` uses `focused()` to run a read-only, directory-scoped `git diff --numstat` on the terminal’s machine. It updates on focus or directory change and polls every five seconds while the window is active. Neither mod adds external network calls.

## Watch out

- A worktree is foldable only when its main checkout also has a Space. Worktrees on different machines never group together.
- The amber square includes untracked files; line counts exclude untracked files, binary changes, and changes outside the terminal’s directory. The status bar compares the working tree with `HEAD` (or an empty tree before the first commit), not two diff totals added together.
- Uses the desktop app’s JavaScript mod API, not the Herdr TUI. Both mods depend on the shipped `workspace-chrome` assets; don’t copy the full app defaults into the package.

## Done when

1. Fold a parent with a dirty worktree and a working agent elsewhere in the group. Only the parent remains visible, with the square and spinner. A blocked agent takes precedence. Expanding restores each row’s own badges.
2. Change tracked text in two sibling directories. Focus a terminal in one directory and verify the bar counts only its changes. Switch or revert the edits and verify the count updates.
3. `herdr-app check` passes for both mods, and `layout.switch` can switch between `main` and `herdr-plus`.
