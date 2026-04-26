# Quickstart — 60 seconds to first value

If you can run three commands, you can drive `mg`. Pick `npm` or `curl`, install once, then drive any project.

## Prereqs

- Node.js ≥ 20 (`node --version`)
- A terminal, a project directory

That's it. No Docker, no cloud account, no sign-up.

## Install

```bash
npm install -g @mcp-graph-workflow/cli
```

(Or `curl -fsSL https://mcp-graph.dev/install.sh | sh` — same effect, with a friendly Node-detection check.)

## 60-second tour

```bash
mkdir my-project && cd my-project

mg init                               # 5 sec — bootstrap graph + IDE configs
mg add task --title "fix login flow" --priority 2
mg add task --title "write tests"     --priority 3
mg next                               # ← see the next-up card
```

You should see something like:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ NEXT TASK  node_799f48ee8dfb                                                 │
│                                                                              │
│ fix login flow                                                               │
│                                                                              │
│ type: task  ·  priority: 2                                                   │
│                                                                              │
│ desbloqueada, alta prioridade                                                │
│                                                                              │
│ ▸ start it: mg start node_799f48ee8dfb  ·  see all: mg list                  │
╰──────────────────────────────────────────────────────────────────────────────╯
```

That's the whole loop. From here:

```bash
mg start node_799f48ee8dfb            # status → in_progress, render TDD checklist
# ... do the work ...
mg finish                             # status → done, suggest next
```

## Want the dashboard?

```bash
mg ui
# opens http://localhost:3000 — graph view, search, kanban
```

Ctrl-C to stop.

## Want zero-intervention workflow?

```bash
mg hooks install --profile balanced
```

Three profiles, pick one:

| Profile | Hooks installed | When |
|---|---|---|
| `minimal` | 1 — `SessionStart` health banner | you want a sign of life, nothing more |
| `balanced` *(recommended)* | 5 — `SessionStart`, pre-MCP-tool, post-edit harness scan, post-`finish_task` chain, `Stop` snapshot | daily work, opinionated defaults |
| `aggressive` | 7 — balanced + post-`Bash` + `UserPromptSubmit` | maximum oversight, slightly chattier |

Hooks fire silently and log to `~/.mcp-graph/logs/hooks.jsonl`. Your existing Claude Code hooks are preserved.

To turn off: `mg hooks uninstall` (idempotent). To check what's installed: `mg hooks status`.

## Want to try it without committing to a project?

```bash
mg demo
```

Creates an ephemeral sandbox under `~/.mcp-graph/demos/<stamp>/` with a sample PRD already imported. Poke around for as long as you want; clean up later with `mg demo --cleanup` or `rm -rf <path>`.

## Verify what you have installed

Two commands, two answers:

```bash
mg --version           # 11.x.x-beta — the v11 CLI you just installed
mcp-graph --version    # 10.x.x — the MCP server (parent runtime mg talks to)
```

Both should print a version. If `mg --version` works but `mg init` errors with "parent runtime not found", install the server too: `npm install -g @mcp-graph-workflow/mcp-graph`.

## Three-mode invocation

Every command works three ways — same handler, three entry points:

| Mode | How | When to use |
|---|---|---|
| **REPL** | `mg` then `/cmd` | daily interactive work |
| **Shell** | `mg cmd` | scripts, CI, quick one-shots |
| **Claude skill** | `/cmd` inside Claude Code | when already in an agent chat |

The Claude skills are auto-installed in your project by `mg init` (under `.claude/skills/`). Type `/` in Claude Code and you'll see them in the autocomplete list.

## What's next

- **Cheatsheet** — every command on one page: [CHEATSHEET.md](CHEATSHEET.md)
- **Full guide** — concepts, lifecycle, three modes side-by-side: [GUIDE.md](GUIDE.md)
- **Three modes side-by-side** — when to use Claude tool vs `mg` shell vs REPL slash: [v11 surface map](../guides/v11-cli-surface-map.md)
- **Browse all commands** — `mg help` (or `mg help <fuzzy-query>`, e.g. `mg help auth`)

## Troubleshooting

If `mg --version` works but `mg init` errors with "parent runtime not found", the parent npm package isn't installed yet:

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Or in a monorepo dev setup, build the parent project first (`npm --prefix path/to/parent run build`) and set `MG_PARENT_DIST=/abs/path/to/dist`.

For everything else: `docs/getting-started/TROUBLESHOOTING.md` or open an issue at https://github.com/diegonogueira/mcp-graph-workflow/issues.

## License

AGPL-3.0-or-later · Copyright © 2026 Diego Lima Nogueira de Paula
