# Herdr Plus

**See what’s running and what changed without leaving your workspace.**

A community layout for [Herdr Desktop](https://herdr.dev/). It keeps the default layout familiar and replaces just the Spaces list and the bottom status bar.

![Herdr Plus with expanded worktrees, agent badges, and line counts](preview.png)

| | What you get |
|---|---|
| **Foldable worktrees** | Fold a project without stopping its agents. The parent row shows whether anything changed and the most urgent agent status across the group. Branch and `↑/↓` still describe the parent checkout. |
| **Status at a glance** | An amber square marks uncommitted changes. A ring spins while an agent is working, `!` means blocked, and a dot marks done. Priority: blocked → working → done. |
| **Live line counts** | Green `+` and red `−` show tracked text changes against `HEAD` under the focused terminal’s current directory, including staged and unstaged edits. |

![Close-up of the folded Spaces sidebar](screenshots/folded-worktrees.png)

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
