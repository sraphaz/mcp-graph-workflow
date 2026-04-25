# v11 Maestro Surface — migration guide

The **v11 Maestro Surface Refactor** ([PRD](../prd/v11-maestro-surface-refactor.md)) trims the MCP tool surface so `mcp-graph` becomes a maestro: it tracks what was done, but delegates execution to external arms (native Write, Playwright MCP, Browser Use MCP, Context7) via the plan-payload contract.

This guide lists every tool and analyze mode scheduled for removal in **Fase 5**, with concrete `before` → `after` examples. **No public signature changes**: deprecated tools stay live in advisory mode for at least 30 days before any physical removal, and `MCP_GRAPH_LEGACY_TOOLS=on` re-enables removed tools temporarily.

> File path: `docs/migration/v11-maestro-surface.md` — the path conventional-commit footers and release-please reference when surfacing this guide in the generated `CHANGELOG.md` / release notes.

## TL;DR

| Removed (or scheduled) | Replacement | Stage today |
|---|---|---|
| `forecast({mode: "dora"})` | `metrics({mode: "dora_metrics"})` (Task 5.4) | scheduled `removed` after telemetry gate |
| `davinci(*)` | no direct replacement (specialized) | scheduled `removed` after telemetry gate |
| `siebel(*)` | no direct replacement (specialized) | scheduled `removed` after telemetry gate |
| `translate(*)` | no direct replacement (specialized) | scheduled `removed` after telemetry gate |
| `analyze({mode: "cfd"})` | no direct replacement (orphan mode) | scheduled `removed` if telemetry=0 |
| `analyze({mode: "code_sync"})` | no direct replacement (orphan mode) | scheduled `removed` if telemetry=0 |
| `analyze({mode: "economy_simulation"})` | no direct replacement (orphan mode) | scheduled `removed` if telemetry=0 |
| `validate({action: "task"})` | `graph_validate_ui` (plan-payload → Playwright MCP) | `advisory` (Fase 4 already shipped) |
| `set_phase` (MCP tool) | `mg set-phase` CLI | `advisory` (Wave D2, hooks-collapse epic) |

## Deprecation lifecycle

The deprecation gate lives in [`src/mcp/unified-gate.ts`](../../src/mcp/unified-gate.ts) (`DEPRECATED_TOOLS` map, Task 5.1). Each entry is one of three stages:

| Stage | Behaviour | What you see |
|---|---|---|
| `advisory` | Tool runs normally. A `warn` log is emitted server-side. | Nothing in the response — silent. |
| `warning` | Tool runs normally. Response gains an extra `_deprecation_notice` content item. | `_deprecation_notice: { tool, stage, replacement, migrationDoc, since }`. |
| `removed` | Tool is blocked before execution. | `{ error: "tool_removed", tool, replacement, hint }` with `isError: true`. |

**Escape hatch:** export `MCP_GRAPH_LEGACY_TOOLS=on` and any `removed` tool is downgraded to `advisory` for the lifetime of that process — the original handler runs, and a warn log records the override. Use it to unblock production while you migrate; do not bake it into a permanent config.

The 30-day telemetry gate (`metrics({mode: "tool_usage", sinceDays: 30})`) gates physical removal: a tool only graduates from `advisory` → `removed` when `callCount=0` for the full window.

## Tools removed (Fase 5)

### `forecast` → `metrics({mode: "dora_metrics"})`

`forecast` exposed exactly one analytic — DORA delivery metrics — under `mode: "dora"`. Task 5.4 folds the same logic into `metrics` so there is one entry point for delivery analytics.

```jsonc
// Before — v10.x
{
  "tool": "forecast",
  "args": { "mode": "dora" }
}

// After — v11
{
  "tool": "metrics",
  "args": { "mode": "dora_metrics" }
}
```

The response payload (DORA metrics + interpretation thresholds) is identical; only the entry point changes.

### `davinci` → no direct replacement

`davinci` was a specialized DaVinci converter (action-routed: `analyze` / `build` / `convert` / `batch_convert`) used by a single internal workflow. Telemetry indicates `callCount=0` over 30 days. There is no general replacement; if you depend on it, keep it alive locally with the escape hatch and open an issue describing the use case so we can scope a proper successor.

```bash
# If you still need davinci while you re-plan the workflow:
export MCP_GRAPH_LEGACY_TOOLS=on
# davinci is now downgraded to advisory — works as before, with a warn log.
```

### `siebel` → no direct replacement

`siebel` consolidated 8 Siebel-CRM helpers (`analyze`, `compose`, `env`, `generate`, `import_docs`, `import_sif`, `search`, `validate`, `batch_import_sif`) under one action-routed tool. Same situation as `davinci`: zero telemetry, no general replacement. Use the escape hatch and open an issue if you need it.

```bash
# Same escape hatch:
export MCP_GRAPH_LEGACY_TOOLS=on
# Or migrate the workflow off mcp-graph for the Siebel-specific portion.
```

### `translate` → no direct replacement

`translate` consolidated 3 translation helpers (`translate_code`, `analyze_translation`, `translation_jobs`) plus `batch_convert`. No general replacement.

```bash
# Same pattern:
export MCP_GRAPH_LEGACY_TOOLS=on
```

## Analyze modes removed

These three modes of the `analyze` tool have shown `callCount=0` over the telemetry window and are scheduled for removal alongside the tools above. The `analyze` tool itself stays — only these modes are dropped.

### `analyze({mode: "cfd"})`

Cumulative-flow-diagram mode. No direct replacement; sprint health is covered by `analyze({mode: "sprint_health"})` and `analyze({mode: "progress"})`.

```jsonc
// Before — v10.x
{ "tool": "analyze", "args": { "mode": "cfd" } }

// After — v11 — closest equivalent
{ "tool": "analyze", "args": { "mode": "sprint_health" } }
```

### `analyze({mode: "code_sync"})`

Detected stale references between the graph and code. Code Intelligence already runs as a passive gate via `unified-gate.ts` (it warns on stale index automatically), so this mode is redundant.

```jsonc
// Before — v10.x
{ "tool": "analyze", "args": { "mode": "code_sync" } }

// After — v11 — index status is reported automatically with every tool call's
// _code_intelligence block. Re-index manually if needed:
{ "tool": "knowledge", "args": { "action": "reindex" } }
```

### `analyze({mode: "economy_simulation"})`

Game-economy simulator (gold inflow/outflow inflation detector). No direct replacement; this was scoped for a single internal experiment.

```bash
# If you still need it during migration:
export MCP_GRAPH_LEGACY_TOOLS=on
```

## set_phase

The MCP `set_phase` tool moves to a first-class CLI command, `mg set-phase`. The 7 settings it writes (`lifecycle_strictness_mode`, `code_intelligence_mode`, `tool_prerequisites_mode`, `team_task_mode`, `wip_strict_mode`, `wip_max_in_flight`, `autopilot`) plus the optional phase override stay in the same SQLite location (`project_settings`); only the invocation surface changes. The MCP tool keeps working through the deprecation window, emits a silent server-side warn log, and graduates `advisory` → `warning` → `removed` across two minor releases (v11.x.3 and v12.0 per the hooks-collapse epic plan).

```jsonc
// Before — v10.x / early v11.x
{
  "tool": "set_phase",
  "args": { "phase": "IMPLEMENT", "mode": "strict", "codeIntelligence": "advisory" }
}

// After — v11.x — same SQLite settings, CLI surface
// shell:
//   mg set-phase IMPLEMENT --mode strict --code-intel advisory
```

The CLI delegates to the same `setPhaseCore(store, opts)` function the MCP tool uses, so behaviour is byte-identical. JSON output mode (`mg set-phase ... --json`) emits the `SetPhaseResult` shape that the MCP tool currently returns.

## Subset deprecation — `validate({action: "task"})` → `graph_validate_ui`

The Fase 4 *Bracos Externos* work (Task 4.3) introduced `graph_validate_ui`, which returns a plan-payload routing the call to the **Playwright MCP** (so `mcp-graph` no longer needs Playwright as a direct dependency). `validate({action: "task"})` keeps working for the 30-day window and emits a `_deprecation_notice` on every response.

```jsonc
// Before — v10.x — validate runs Playwright in-process
{
  "tool": "validate",
  "args": {
    "action": "task",
    "nodeId": "node_xxx",
    "checks": ["a11y", "console-errors"]
  }
}

// After — v11 — graph_validate_ui returns a plan-payload that the agent
// executes against Playwright MCP (browser_navigate + browser_snapshot +
// browser_console_messages)
{
  "tool": "graph_validate_ui",
  "args": {
    "nodeId": "node_xxx",
    "checks": ["a11y", "console-errors"]
  }
}
```

The plan-payload contract is documented in [`src/mcp/contracts/plan-payload.ts`](../../src/mcp/contracts/plan-payload.ts) (Task 4.1). `validate({action: "task"})` will graduate from `advisory` → `removed` once telemetry confirms zero calls.

## Release notes / CHANGELOG linkage

This guide is referenced from the parent package's auto-generated `CHANGELOG.md` (managed by [release-please](../../release-please-config.json)). The release-please pipeline picks up commits whose body or footer includes a `BREAKING CHANGE:` trailer or a `docs:` reference to `docs/migration/v11-maestro-surface.md`, and threads the link into the generated release notes.

Conventional-commit example for any task in this migration:

```
feat(unified-gate): mark `forecast` as deprecated:warning

Adds DEPRECATED_TOOLS entry routing forecast → metrics({mode: "dora_metrics"}).

See docs/migration/v11-maestro-surface.md for the full migration map.

BREAKING CHANGE: forecast tool is now in `warning` stage; responses include
_deprecation_notice. Will graduate to `removed` after the 30-day telemetry gate.
```

Once such a commit lands, release-please surfaces this file's path in the next release entry under the `Features` / `Breaking changes` sections.

## Related

- PRD: [`docs/prd/v11-maestro-surface-refactor.md`](../prd/v11-maestro-surface-refactor.md)
- Deprecation gate: [`src/mcp/unified-gate.ts`](../../src/mcp/unified-gate.ts) (`DEPRECATED_TOOLS`, `resolveEffectiveStage`, `buildRemovedToolError`)
- Tests: [`src/tests/unified-gate-deprecation.test.ts`](../../src/tests/unified-gate-deprecation.test.ts), [`src/tests/migration-doc-v11-maestro.test.ts`](../../src/tests/migration-doc-v11-maestro.test.ts)
- Release config: [`release-please-config.json`](../../release-please-config.json)
