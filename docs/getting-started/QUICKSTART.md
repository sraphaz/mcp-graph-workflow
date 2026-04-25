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
mg hooks install
```

Now Claude Code automatically:
- prints a 1-line health banner at session start
- runs an incremental harness scan after every Edit/Write
- chains `validate(ac)` + `analyze(implement_done)` after every `finish_task`
- snapshots the graph at session stop

Nothing in your shell changes. The hooks fire silently and log to `~/.mcp-graph/logs/hooks.jsonl`.

To turn off: `mg hooks uninstall` (idempotent — your other Claude Code hooks are preserved).

## Want to try it without committing to a project?

```bash
mg demo
```

Creates an ephemeral sandbox under `~/.mcp-graph/demos/<stamp>/` with a sample PRD already imported. Poke around for as long as you want; clean up later with `mg demo --cleanup` or `rm -rf <path>`.

## Three-mode invocation

Every command works three ways — same handler, three entry points:

| Mode | How | When to use |
|---|---|---|
| **REPL** | `mg` then `/cmd` | daily interactive work |
| **Shell** | `mg cmd` | scripts, CI, quick one-shots |
| **Claude skill** | `/cmd` inside Claude Code | when already in an agent chat |

The Claude skills are auto-installed in your project by `mg init` (under `.claude/skills/`). Type `/` in Claude Code and you'll see them in the autocomplete list.

## What's next

- Browse all 15 commands: `mg help`
- Search the command palette: `mg help <fuzzy-query>` (e.g. `mg help auth`)
- See the full lifecycle: `docs/getting-started/GUIDE.md`
- Migrating from v10? `docs/_internal/migration/v10-to-v11-cli.md`
- Cookbook of common patterns: `docs/getting-started/CHEATSHEET.md`

## Troubleshooting

If `mg --version` works but `mg init` errors with "parent runtime not found", the parent npm package isn't installed yet:

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Or in a monorepo dev setup, build the parent project first (`npm --prefix path/to/parent run build`) and set `MG_PARENT_DIST=/abs/path/to/dist`.

For everything else: `docs/getting-started/TROUBLESHOOTING.md` or open an issue at https://github.com/diegonogueira/mcp-graph-workflow/issues.

## License

AGPL-3.0-or-later · Copyright © 2026 Diego Lima Nogueira de Paula
