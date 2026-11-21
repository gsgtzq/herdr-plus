# Herdr Plus

**See what’s running, what changed, and how busy the machine is.**

A community layout for [Herdr Desktop](https://herdr.dev/). It keeps the default layout familiar and replaces just the Spaces list and the bottom status bar.

![Herdr Plus showing expanded worktrees, agent badges, CPU history, memory usage, and Git line counts](preview.png)

| | What you get |
|---|---|
| **Foldable worktrees** | Fold a project without stopping its agents. The parent row shows whether anything changed and the most urgent agent status across the group. Branch and `↑/↓` still describe the parent checkout. |
| **Branch-based worktrees** | Right-click a Git Space: **New branch and worktree…** creates a branch from a local or fetched remote base; **Checkout existing branch…** creates only a worktree for a local branch. |
| **Status at a glance** | An amber square marks uncommitted changes. A ring spins while an agent is working, `!` means blocked, and a dot marks done. Priority: blocked → working → done. |
| **Live line counts** | Green `+` and red `−` show tracked text changes against `HEAD` under the focused terminal’s current directory, including staged and unstaged edits. |
| **Machine usage** | The status bar follows the active workspace’s machine (macOS or Linux). It shows one-second CPU snapshots every three seconds while the window is active, plus the latest memory usage. Hover for CPU load, memory totals, home disk space, and uptime. |
| **macOS Dock badge** | Counts blocked or finished agents you haven't viewed. Focus each agent’s terminal to clear its alert without clearing the others. |

![Close-up of the folded Spaces sidebar](screenshots/folded-worktrees.png)

![Close-up of CPU history, the memory meter, and Git line counts](screenshots/status-bar.png)

## Install

Requires Git and Herdr Desktop (tested with **0.1.16**). Launch Herdr once before installing. You can also ask your agent to read `~/.config/herdr-app/AGENTS.md` and install the layout from this repository.

```sh
git clone https://github.com/gsgtzq/herdr-plus.git
cd herdr-plus
app_home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
cp -R layouts mods "$app_home/"
herdr-app do layout.switch --name herdr-plus
```

Back up any files you already have with these same names before copying. To switch back: `herdr-app do layout.switch --name main`.

[Build recipe](RECIPE.md) · [Apache 2.0](LICENSE) · [Upstream attribution](NOTICE)
