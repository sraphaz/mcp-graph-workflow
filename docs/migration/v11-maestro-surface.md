# V11 Maestro Surface — Migration Guide

This document tracks every tool/mode that the V11 Maestro Surface Refactor deprecates or removes. The flow is **advisory → warning → removed** with a 30-day telemetry gate before any physical removal (see [ADR 0042](../adr/0042-maestro-surface-refactor.md)).

> **Rollback:** any tool intercepted as `removed` can be temporarily re-enabled in `advisory` mode by setting `MCP_GRAPH_LEGACY_TOOLS=on`. This is an emergency switch; the long-term path is to migrate to the replacement.

## Stages

| Stage | Behavior |
|---|---|
| `advisory` | Tool runs as before. Silent debug log. (Window for telemetry to prove `callCount=0`.) |
| `warning`  | Tool runs as before. Response includes `_deprecation_notice` field — visible to LLMs / agents. |
| `removed`  | Tool returns a structured error pointing at the replacement. Honors `MCP_GRAPH_LEGACY_TOOLS=on`. |

## Telemetry gate

Before promoting any entry from `advisory` → `warning`, the operator must check:

```
metrics({mode: "tool_usage", sinceDays: 30})
```

A candidate is eligible only when `callCount=0` over the previous 30 days. The same check applies before `warning` → `removed`.

---

## Deprecation index — V11.0

### `davinci`

- **Stage:** advisory (since v11.0)
- **Replacement:** Use `graph_materialize` for diagram artifacts. Davinci's PingAccess→Java conversion will move to a focused tool after the 30-day gate proves it's unused.
- **Migration:**
  ```js
  // Before
  davinci({ action: "render", target: "..." })
  // After
  graph_materialize({ nodeId: "...", artifact: "mermaid", filePath: "..." })
  ```

### `siebel`

- **Stage:** advisory (since v11.0)
- **Replacement:** Use `graph_validate_ui` (UI checks) or `graph_explore_web` (agentic exploration) depending on intent. Siebel's domain-specific validation is being absorbed into the maestro's plan-payload pattern.
- **Migration:**
  ```js
  // Before
  siebel({ action: "validate", url: "..." })
  // After
  graph_validate_ui({ nodeId: "...", url: "...", checks: ["a11y", "console-errors"] })
  ```

### `translate`

- **Stage:** advisory (since v11.0)
- **Replacement:** If you need translation in test/journey flows, prefer the journey/capture pipeline. `translate` is scheduled for removal after the V11 telemetry gate.
- **Migration:** No 1:1 replacement — this tool sees ~zero call volume and is being retired.

### `forecast`

- **Stage:** advisory (since v11.0)
- **Replacement:** `metrics({mode: "dora_metrics"})` returns the same DORA payload (deployment frequency, lead time, change failure rate, MTTR + interpretation).
- **Migration:**
  ```js
  // Before
  forecast({ mode: "dora" })
  // After
  metrics({ mode: "dora_metrics" })
  ```

### `sync_stack_docs`

- **Stage:** advisory (since v11.0)
- **Replacement:** `graph_refresh_docs` — identical behavior, namespace-consistent with the `graph_*` family.
- **Migration:**
  ```js
  // Before
  sync_stack_docs({ basePath: "...", libraries: [...] })
  // After
  graph_refresh_docs({ basePath: "...", libraries: [...] })
  ```

### `validate(action="task")`

- **Stage:** advisory (since v11.0) — response now includes `_deprecation_notice` pointing at `graph_validate_ui`.
- **Replacement:** `graph_validate_ui` — emits a plan-payload that the agent client executes via Playwright MCP. Decoupling guarantee: `mcp-graph` no longer imports `playwright` from this path.
- **Migration:**
  ```js
  // Before
  validate({ action: "task", url: "...", nodeId: "..." })
  // After
  graph_validate_ui({ nodeId: "...", url: "...", checks: ["a11y", "console-errors", "network-requests"] })
  ```

### `analyze({mode: "cfd"})` / `analyze({mode: "code_sync"})` / `analyze({mode: "economy_simulation"})`

- **Stage:** advisory (modes only — the `analyze` tool itself is NOT deprecated).
- **Status:** Watching for `callCount=0` evidence over 30 days. These are candidate orphan modes; we'll remove only after the gate.

#### How to verify an orphan analyze mode (operator)

The tool-level `metrics({mode: "tool_usage"})` aggregates by tool name only. To verify per-mode usage, query `tool_call_log` directly (it captures the full `tool_args` JSON for every successful call):

```sql
-- Run via query_graph or any read-only SQLite client:
SELECT
  json_extract(tool_args, '$.mode') AS mode,
  COUNT(*)                           AS call_count,
  MAX(called_at)                     AS last_used
FROM tool_call_log
WHERE tool_name = 'analyze'
  AND called_at >= datetime('now', '-30 days')
  AND json_extract(tool_args, '$.mode') IS NOT NULL
GROUP BY mode
ORDER BY call_count ASC;
```

Or programmatically via the new helper:

```ts
import { ToolCallLog } from "src/core/store/tool-call-log.js";

const log = new ToolCallLog(db);
// Without candidates: only modes that were actually called.
const observed = log.getModeCallCounts(projectId, "analyze", 30);
// With candidates: zero-count orphans surface explicitly.
const withOrphans = log.getModeCallCounts(projectId, "analyze", 30, [
  "cfd", "code_sync", "economy_simulation",
]);
```

If a candidate mode shows `callCount=0` for 30 days, it's safe to remove from:
1. `ANALYZE_MODES` enum in `src/mcp/tools/analyze.ts`
2. Its `case` arm in the analyze handler's switch
3. `ALL_ANALYZE_MODES` in `src/core/planner/lifecycle-phase.ts`
4. The phase mapping in `PHASE_MODE_MAP`
5. `ALL_ANALYZE_MODES.length` assertion in `src/tests/get-modes-for-phase.test.ts` (drop from 53 to N)
6. The corresponding entry in `DEPRECATED_MODES` (`src/mcp/deprecated-modes.ts`)

#### Mode deprecation enforcement (DEPRECATED_MODES)

Mode-level deprecation has its own gate keyed by `(toolName, modeArg)`. The 3-stage cycle is identical to tool-level (`advisory → warning → removed`) and shares the `MCP_GRAPH_LEGACY_TOOLS=on` rollback flag.

The unified-gate runs the mode check immediately after the tool check. Tool-level deprecation takes precedence; mode-level is the fallback when the tool itself is healthy. The map lives in `src/mcp/deprecated-modes.ts`:

```ts
export const DEPRECATED_MODES = {
  analyze: {
    cfd:                 { stage: "advisory", replacement: "...", sinceVersion: "v11.0" },
    code_sync:           { stage: "advisory", replacement: "...", sinceVersion: "v11.0" },
    economy_simulation:  { stage: "advisory", replacement: "...", sinceVersion: "v11.0" },
  },
};
```

---

## Promotion rules (operator)

1. **`advisory` → `warning`** — Run `metrics({mode: "tool_usage", sinceDays: 30})`. If `callCount === 0`, edit `src/mcp/deprecated-tools.ts` and bump `stage` to `"warning"`. Open a one-line PR titled `chore(deprecation): warn ${tool} (V11 30d gate cleared)`.
2. **`warning` → `removed`** — After another 30 days at `warning` and still `callCount === 0`, repeat with `stage: "removed"`. The tool now errors at the gate; `MCP_GRAPH_LEGACY_TOOLS=on` is the rollback.
3. **Physical removal** — Only after the entry has been at `removed` for at least one release cycle and no `MCP_GRAPH_LEGACY_TOOLS=on` reports come in.

## Audit trail

Every transition is captured in `git log` against `src/mcp/deprecated-tools.ts`. The `unified-gate.ts` middleware additionally records every invocation via `tool_token_usage`, so attempts to call a removed tool are traceable.
