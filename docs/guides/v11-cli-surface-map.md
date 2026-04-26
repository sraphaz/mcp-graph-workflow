# v11 CLI Surface Map — replaces legacy `mcp__mcp-graph__*` MCP calls

**Status:** beta. `@mcp-graph-workflow/mcp-graph@>=12` (CLI surface unified). Install: `npm i -g @mcp-graph-workflow/mcp-graph`.

> **Coverage:** v11 CLI exposes lifecycle verbs (`start`, `finish`, `next`, `list`, `status`, `add`, `set-phase`) plus ops (`init`, `hooks`, `ui`, `demo`, `login`, `lang`, `config`, `log`, `harness`, `help`). The other ~45 tools (`analyze`, `validate`, `search`, `node`, `edge`, `metrics`, `journey`, `code_intelligence`, `kanban`, `import_prd`, `plan_sprint`, etc.) remain **MCP-only** — invoke them from Claude Code, Cursor, or Copilot CLI via the standard `mcp__mcp-graph__<tool>` surface. The migration table below shows only commands that have a `mcp-graph` form today.

The v11 CLI exposes lifecycle verbs through a three-mode parity surface (ADR-0053): a slash command for Claude skills, a shell command for terminal/CI, and the same handler routed locally instead of via MCP round-trip. Skills that historically called `mcp__mcp-graph__<tool>` should prefer the slash/shell form when one exists.

## Migration table

| Legacy MCP tool | Claude slash | Shell (`mcp-graph`) | Notes |
|---|---|---|---|
| `mcp__mcp-graph__start_task` | `/start [<id>]` | `mcp-graph start [<id>]` | Picks up next task if no id; same start_task pipeline (next + context + rag + status). |
| `mcp__mcp-graph__finish_task` | `/finish [<id>]` | `mcp-graph finish [<id>]` | Auto-detects in_progress task if no id; runs DoD 9 checks + AC validation. |
| `mcp__mcp-graph__next` | `/next` | `mcp-graph next` | Animated card form in REPL; `--id` flag for id-only output. |
| `mcp__mcp-graph__update_status` | `/status` | `mcp-graph status` | One-screen project health: tasks + sprint + harness + bridge auth. |
| `mcp__mcp-graph__list` | `/list` | `mcp-graph list` | Filters: `--status`, `--type`, `--search`, `--blocked`, `--all`, `--limit`. |
| `mcp__mcp-graph__add_node` (legacy) | `/add <type>` | `mcp-graph add <type> --title "..."` | Provenance-tagged. |
| `mcp__mcp-graph__set_phase` (deprecated v11, removed v12) | `/set-phase <PHASE>` | `mcp-graph set-phase <PHASE> [--mode strict\|advisory] [--code-intel ...] [--prerequisites ...]` | Hard-prefer the v11 surface — MCP tool emits a structured deprecation warning. |
| `mcp__mcp-graph__init` (legacy) | `/init [--force]` | `mcp-graph init [--force]` | Project fingerprint + IDE detection + scaffold. |
| `mcp__mcp-graph__demo` (legacy) | `/demo [--cleanup]` | `mcp-graph demo [--cleanup]` | Ephemeral sandbox with sample PRD. |

## Tools that stay MCP (no v11 surface yet)

These keep their `mcp__mcp-graph__*` form until they get registered in `tools/cli/src/commands/builtins.ts` (tracked in `project_v11_skills_hooks_migration.md`):

- `analyze` — 53 modes (tdd_check, code_sync, prd_quality, scope, harness_scan, etc.)
- `validate` — `action: task` (browser validation) + `action: ac` (AC quality)
- `search` — fts/bm25/tfidf graph search
- `node` — CRUD + batch_add (use `/add` if creating; `node` directly for batch/update)
- `edge` — relationship CRUD
- `metrics` — sprint/throughput/cycle-time
- `export` — graph snapshot + mermaid + JSON
- `code_intelligence` — symbol analysis + impact + execution flow
- `write_memory` / `read_memory` / `list_memories` / `delete_memory` — knowledge store
- `context` — tiered + rag + compact
- `graph_lifecycle` / `graph_materialize` / `graph_validate_ui` / `graph_explore_web` / `graph_refresh_docs` — V11 Maestro plan-payload arms

## Why prefer v11 surface

- **Faster:** local handler (in-process), no MCP server round-trip via stdio.
- **Three-mode parity:** same logic from REPL slash, shell command, and Claude skill. Single source of truth in `tools/cli/src/commands/builtins.ts`.
- **Hooks coverage:** PreToolUse/SessionStart/Stop hooks (installed by `mcp-graph init`) automate the lifecycle bookkeeping that explicit MCP calls used to do manually.
- **Drop deprecated pointers:** `set_phase` is being removed in v12 per ADR-0049. Skills that still call it via MCP will break; v11 surface (`mcp-graph set-phase`) keeps working.

## Backwards compat

The legacy `mcp__mcp-graph__*` tools still work for users who haven't installed the v11 CLI. Deprecated tools (`set_phase`) emit structured `_deprecation_notice` per ADR-0054 v2 + ADR-0049. The migration is opportunistic, not a hard cutover.

## Source of truth

Registry: `tools/cli/src/commands/builtins.ts`. To verify what slash/shell forms exist:

```bash
mcp-graph help                # full command palette
mcp-graph help <query>        # fuzzy match (e.g. `mcp-graph help phase`)
```
