# CLI Surface Map — three modes for the same action

**Status:** stable (v12 GA). Single bin (`mcp-graph`); three invocation modes (Claude tool / shell / REPL slash). All commands shipped via `npm install -g @mcp-graph-workflow/mcp-graph`.

> **Coverage:** the CLI exposes lifecycle verbs (`start`, `finish`, `next`, `list`, `status`, `add`, `set-phase`) plus ops (`init`, `hooks`, `ui`, `demo`, `login`, `lang`, `config`, `log`, `harness`, `help`). Other ~45 tools (`analyze`, `validate`, `search`, `node`, `edge`, `metrics`, `journey`, `code_intelligence`, `kanban`, `import_prd`, `plan_sprint`, etc.) remain **MCP-only** — invoke them from Claude Code, Cursor, or Copilot CLI via the standard `mcp__mcp-graph__<tool>` surface. The migration table below shows commands that have a `mcp-graph` shell/slash form.

The CLI exposes lifecycle verbs through a three-mode parity surface: a slash command for Claude skills, a shell command for terminal/CI, and the same handler routed locally instead of via MCP round-trip. Skills that call `mcp__mcp-graph__<tool>` are encouraged to prefer the slash/shell form when one exists.

## Equivalence table

| MCP tool | Claude slash | Shell (`mcp-graph`) | Notes |
|---|---|---|---|
| `mcp__mcp-graph__start_task` | `/start [<id>]` | `mcp-graph start [<id>]` | Picks up next task if no id; runs the start_task pipeline (next + context + rag + status). |
| `mcp__mcp-graph__finish_task` | `/finish [<id>]` | `mcp-graph finish [<id>]` | Auto-detects in_progress task if no id; runs DoD 9 checks + AC validation. |
| `mcp__mcp-graph__next` | `/next` | `mcp-graph next` | Animated card form in REPL; `--id` flag for id-only output. |
| `mcp__mcp-graph__update_status` | `/status` | `mcp-graph status` | One-screen project health: tasks + sprint + harness + bridge auth. |
| `mcp__mcp-graph__list` | `/list` | `mcp-graph list` | Filters: `--status`, `--type`, `--search`, `--blocked`, `--all`, `--limit`. |
| `mcp__mcp-graph__add_node` | `/add <type>` | `mcp-graph add <type> --title "..."` | Provenance-tagged. |
| `mcp__mcp-graph__set_phase` | `/set-phase <PHASE>` | `mcp-graph set-phase <PHASE> [--mode strict\|advisory] [--code-intel ...] [--prerequisites ...]` | Both forms work. The shell form is faster (in-process); the MCP form keeps working for backwards compat. |
| `mcp__mcp-graph__init` | `/init [--force]` | `mcp-graph init [--force]` | Project fingerprint + IDE detection + scaffold. |
| `mcp__mcp-graph__demo` | `/demo [--cleanup]` | `mcp-graph demo [--cleanup]` | Ephemeral sandbox with sample PRD. |

## Tools available only via MCP

These tools don't have a `mcp-graph` shell/slash form yet — invoke them from inside Claude Code/Cursor via `mcp__mcp-graph__<tool>`:

- `analyze` — 53 modes (tdd_check, code_sync, prd_quality, scope, harness_scan, etc.)
- `validate` — `action: task` (browser validation) + `action: ac` (AC quality)
- `search` — fts/bm25/tfidf graph search
- `node` — CRUD + batch_add (use `/add` if creating one; `node` directly for batch/update)
- `edge` — relationship CRUD
- `metrics` — sprint/throughput/cycle-time
- `export` — graph snapshot + mermaid + JSON
- `code_intelligence` — symbol analysis + impact + execution flow
- `write_memory` / `read_memory` / `list_memories` / `delete_memory` — knowledge store
- `context` — tiered + rag + compact
- `graph_lifecycle` / `graph_materialize` / `graph_validate_ui` / `graph_explore_web` / `graph_refresh_docs` — Maestro plan-payload arms

## When to use shell vs MCP

- **Shell `mcp-graph`** — scripts, CI, one-shot runs. Local handler (in-process), no MCP round-trip. Zero token cost.
- **MCP tool (Claude direto)** — already in an agent chat, want the agent to drive the action. Tokens are paid by the agent.
- **REPL `/cmd`** — interactive session, discovery via `mcp-graph repl` then `/help`.

## Source of truth

The full command palette lives in the registry. To inspect:

```bash
mcp-graph help                # full command palette
mcp-graph help <query>        # fuzzy match (e.g. `mcp-graph help phase`)
```
