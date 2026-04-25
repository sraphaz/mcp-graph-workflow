# `mg` — MCP Graph Workflow CLI

Modern, REPL-first CLI for graph-driven AI dev workflows. Drop into any project, get a structured execution graph, hand it to Claude Code / Cursor / VS Code Copilot, ship.

```bash
npm install -g @mcp-graph-workflow/cli

cd your-project
mg init                 # bootstrap graph + IDE configs (zero JSON-by-hand)
mg add task --title "fix login flow" --priority 2
mg next                 # animated card of the next unblocked task
mg start <id>           # → in_progress, render TDD checklist
mg finish               # → done + next-task suggestion
```

Or just `mg` to enter the interactive REPL with `/init`, `/next`, `/help`, `/exit`.

## Why

You already have great AI assistants. What you don't have is a **persistent, queryable, human-checkable graph** of every task / epic / decision / risk on your project — one that the AI agents can read, write, and reason about without your review every time.

`mg` gives you:

- **A SQLite graph** at `workflow-graph/graph.db` — local-first, no cloud, no Docker.
- **15 commands** that cover 90% of daily use (per ADR-0053).
- **Auto-generated IDE configs** (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.claude/settings.local.json`, skills) so your tools just work.
- **Smart Claude Code hooks** that auto-fire harness scans on edit, status banners on session start, snapshots on stop. Zero manual `harness scan` commands.
- **Provenance metadata** on every node — `{source, actor, cmd, trace_id, ts}` — so `mg log --task <id>` reconstructs the full lifecycle later.
- **Redacted structured logs** (`~/.mcp-graph/logs/*.jsonl`) — 8 default token patterns scrubbed at the writer boundary.
- **Modern UX** — Ink-based animated cards, `/slash` REPL, fuzzy autocomplete, color/spinner output. Same mental model as `gh copilot`, `vercel`, `astro`.

## Install

### npm (primary)

```bash
npm install -g @mcp-graph-workflow/cli
mg --version
```

### One-line curl (recommended for non-technical users)

```bash
curl -fsSL https://mcp-graph.dev/install.sh | sh
```

The script detects `node` ≥ 20; if missing, it points you at Volta/fnm/nvm with copy-pasteable commands. **Never silently installs Node.** SHA-256 published in this README so you can verify before piping to shell.

### Standalone binary (locked-down boxes)

GitHub Releases ships per-OS binaries built with `bun --compile`:

```
mg-linux-x64
mg-linux-arm64
mg-macos-x64
mg-macos-arm64
mg-windows-x64.exe
```

No Node required.

See **[ADR-0051](../../docs/_internal/adr/0051-cli-distribution.md)** for the full distribution rationale.

## Commands

```
mg help               searchable command palette (typo-tolerant)
mg version            print version
mg exit               leave the REPL

mg init [--force]     bootstrap project + auto-emit IDE configs
mg demo               ephemeral sandbox for first-value tour
mg add <type> ...     create node with provenance metadata
mg list [filters]     searchable task browser
mg next               next unblocked task (Ink card)
mg start <id>         status → in_progress + TDD checklist
mg finish [<id>]      status → done + next-task suggestion
mg login [--fresh]    GitHub Copilot device-flow auth (no VS Code)
mg ui [--port N]      launch the dashboard at localhost:3000
mg status [--oneline] 1-screen project health
mg config <action>    sync / check IDE configs
mg hooks <action>     install / uninstall / status for Claude Code hooks
mg log [filters]      query structured logs
mg harness <action>   browser CDP automation (list/start/stop/call/cdp/...)
```

Every command supports `--json` for scripting. Every invocation auto-emits a structured event to `~/.mcp-graph/logs/cli.jsonl` (with secrets redacted at the writer boundary).

## REPL flow

```bash
$ mg
                                 __
   ____ ___   _____ ____          ____ _ _____ ____ _ ____   / /_
  / __ `__ \ / ___// __ \ ______ / __ `// ___// __ `// __ \ / __ \
 / / / / / // /__ / /_/ //_____// /_/ // /   / /_/ // /_/ // / / /
/_/ /_/ /_/ \___// .___/        \__, //_/    \__,_// .___//_/ /_/

MCP Graph Workflow v11.0.0-alpha.1 · REPL
type "/help" to list commands  ·  /exit to leave

▸ /next
▸ /start node_799f48ee8dfb
▸ /finish
▸ /exit
```

## Three-mode parity

Every command is invocable in three forms — **the same handler runs all three**:

| Mode | How | Example |
|---|---|---|
| REPL slash | `mg` then `/cmd` | `mg` → `/init` → `/next` |
| Shell one-shot | `mg cmd` | `mg next` |
| Claude skill | `/cmd` inside Claude Code | `/init`, `/next`, `/browser-harness` |

Skills are auto-emitted by `mg init` into `.claude/skills/`, so once Claude Code reads your project, every `mg` command becomes typeable as `/cmd` in the agent chat.

## What it isn't

- Not a SaaS. No cloud sync, no telemetry by default.
- Not Docker-dependent. Just Node ≥ 20 + SQLite.
- Not a replacement for git, Jira, or Linear. It's a **per-project execution graph** the AI agents can drive.
- Not a no-code tool. You still write the code. `mg` tracks the graph of what to write next.

## Performance

| Metric | v11.0.0-alpha.1 | Target | |
|---|---:|---:|---|
| Cold start (`mg --version`, 10 runs median) | 91 ms | ≤ 500 ms | **5× under** |
| Bundle (`dist/cli.mjs`) | 71 KB | ≤ 3 MB | **42× under** |
| `npm pack` tarball | 19.8 KB | — | |

See `docs/_internal/dx/v10-baseline.md` and `benchmarks/baseline-cli-v11-alpha.json` for the source data.

## Migrating from v10

`@mcp-graph-workflow/mcp-graph` v10.x keeps working. Six-month dual-ship; v12.0 sunsets it.

```bash
mcp-graph stats --json   →   mg status --json   # same JSON shape
mcp-graph init           →   mg init --force    # auto-emits IDE configs
mcp-graph serve          →   mg ui              # same Express :3000
```

Full table at `docs/_internal/migration/v10-to-v11-cli.md`.

## Contributing

```bash
git clone https://github.com/diegonogueira/mcp-graph-workflow
cd mcp-graph-workflow/tools/cli
npm install
npm run build              # esbuild → dist/cli.mjs
npm test                   # vitest (97 tests across 13 files)
npm run compile            # tsc --noEmit
node scripts/bench-coldstart.mjs   # 10-run cold-start benchmark
```

Architecture / design decisions live in `docs/_internal/adr/0050-0053`.

## License

AGPL-3.0-or-later · Copyright © 2026 Diego Lima Nogueira de Paula

Commercial licenses available — see `COMMERCIAL.md` in the repo root.
