# `mcp-graph set-phase` — lifecycle phase + enforcement override

In v10 the lifecycle phase (`ANALYZE` … `DEPLOY` … `LISTENING`) and its enforcement modes were set via the `set_phase` MCP tool — only callable from inside an agent session. In v11 the same operation is a first-class CLI command: `mcp-graph set-phase`. The MCP tool stays available for backwards compat through the v11 line and is removed in v12.

## Quick start

```bash
mcp-graph set-phase IMPLEMENT                   # set current phase
mcp-graph set-phase auto                        # reset to automatic phase detection
mcp-graph set-phase REVIEW --mode strict        # phase + enforcement mode
mcp-graph set-phase --mode advisory             # change mode only, leave phase
mcp-graph set-phase --autopilot --sprint-id S7  # autopilot session
mcp-graph set-phase --code-intelligence off     # disable index enforcement
mcp-graph set-phase --prerequisites strict      # tighten prerequisite checks
mcp-graph set-phase --team-task --max-in-flight 3  # multi-terminal coordination
```

## Valid phases

`ANALYZE`, `DESIGN`, `PLAN`, `IMPLEMENT`, `VALIDATE`, `REVIEW`, `HANDOFF`, `DEPLOY`, `LISTENING`, `auto`.

Each phase activates its own gate set. Run `mcp-graph help phases` or see the project's CLAUDE.md for what's enforced where.

## Persistence

`mcp-graph set-phase` writes to the same SQLite store as the MCP tool — there is no behavioral split. Either entry point produces an identical row in the `lifecycle_state` table. You can mix CLI and MCP usage in the same project; latest-write wins.

## Failure modes

| Exit | Meaning |
|---|---|
| 0 | Override applied (or reset to auto) |
| 2 | Invalid phase / arg combination |
| 3 | Gate refused: phase prerequisites not met. Use `--force` to bypass (strict mode only). |
| 4 | Parent runtime not installed — install `@mcp-graph-workflow/mcp-graph` to use `mcp-graph set-phase`. (Reported as `ParentNotInstalledError`.) |

## Force vs auto

- `--force` overrides the gate validator and writes the phase regardless. Logged as `phase.forced=true`.
- `mcp-graph set-phase auto` clears any override; phase detection resumes from graph state (e.g. `IMPLEMENT` if there are tasks `in_progress`).

## Telemetry

Every call emits a row to `~/.mcp-graph/logs/cli.jsonl`:

```jsonc
{
  "ts": "2026-04-25T18:43:11Z",
  "tool": "set-phase",
  "phase": "REVIEW",
  "mode": "strict",
  "forced": false,
  "ok": true
}
```

Use `mcp-graph log --tool set-phase` to query.

## Migration

If you have agent prompts or hooks that call the MCP `set_phase` tool, switch to `mcp-graph set-phase` at your convenience — the MCP tool is **advisory through v11.x** and **removed in v12.0**. See [`MCP set_phase → mcp-graph set-phase` migration](./set-phase-migration.md) (E4) for the timeline + sed recipe.

## See also

- `mcp-graph hooks install` — installs the SessionStart hook that can auto-fire `mcp-graph set-phase` based on graph drift detection.
- ADR-0053 — v11 CLI surface (`set-phase` listed under §"de-emphasis" because it's specialist, but always available).
- ADR-0054 — capability gate. **Independent**: `set-phase` does not call `assembleSiblingContext` and is not gated.
