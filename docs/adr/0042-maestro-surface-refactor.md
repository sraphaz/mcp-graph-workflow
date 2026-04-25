# ADR 0042 — Maestro Surface Refactor

- **Status:** Accepted
- **Date:** 2026-04-24
- **Deciders:** Diego Nogueira

## Context

The MCP surface of `mcp-graph-workflow` had grown to 38 registered tools and 53 modes inside `analyze`. Three structural problems became visible:

1. **Wrong coupling.** `validate(action="task")` imported a browser-automation library directly, turning a graph-tracking server into a browser executor.
2. **Tools without measured demand.** Specialized tools (`davinci`, `siebel`, `translate`, `forecast`) were candidates for removal, but no telemetry justified the decision — only intuition.
3. **No safe SQL bridge.** Operators reaching for ad-hoc queries opened SQLite directly, bypassing any audit trail and risking accidental writes.

The V11 Maestro refactor reshapes `mcp-graph` into a **maestro**: a server that *describes* the work to do via a `plan-payload` contract and lets the client agent *execute* it. The server tracks the lifecycle; external arms (native file I/O, browser automation, library docs) carry out the side effects.

## Decisions

### 1. Plan-payload over direct MCP-to-MCP calls

**Decision:** `mcp-graph` returns a JSON `plan-payload` describing intent (`{executor, steps[], postCallback?, auditId, nodeId}`). The client agent — which already has every MCP server in its namespace — runs the steps locally.

**Rationale:**
- MCP servers run as isolated stdio processes. Cross-server invocation is not part of the protocol; there is no shared memory, no shared socket, no shared session. Trying to coordinate two MCPs from inside one of them duplicates work the client already does for free.
- Provider-abstraction patterns in the broader ecosystem converge on the same shape: a normalized envelope (executor identity, steps, capability flags) with the caller responsible for execution. Pushing that contract to the boundary between server and agent matches how the runtime actually splits.
- Centralized audit: every payload is born with a UUID stamped into `tool_call_log`. The optional `postCallback` (typically `finish_task(nodeId)`) closes the loop on the same node that emitted the intent.

**Consequences:**
- ✅ Zero coupling between `mcp-graph` and any specific browser/file/HTTP library (verified by grep on the four arm tools — no relevant runtime imports).
- ✅ Clients can log, replay, or diff any plan-payload offline — the contract is JSON.
- ⚠️ Adds a round-trip (server emits plan → client executes → client calls `postCallback`). The cost is acceptable for the audit and decoupling gains; the `finish_task` callback in the payload makes it a single round-trip in practice.
- ⚠️ Clients that forget to invoke the callback leave a node `in_progress` indefinitely. The lease/TTL infrastructure under `mcp/leases/` already handles this case for unrelated reasons.

### 2. Wrapper, not extract, for `graph_lifecycle`

**Decision:** `graph_lifecycle({phase, subCheck?})` is a façade over `analyze`. It runs the modes belonging to a phase via `Promise.allSettled` and aggregates outputs. `analyze` keeps its 53-mode surface intact.

**Rationale:**
- Promoting each `analyze` mode to a top-level tool would push the registered surface from 38 to 91 tools. Some modes are only meaningful when run together (e.g. `prd_quality + ready` for ANALYZE) — separating them would force callers to rebuild that affinity by hand.
- The patterns that scale come from descriptive abstractions, not behavioural ones. A façade describes the grouping (which modes belong to which phase) without re-implementing logic.
- Token cost stays bounded: the wrapper's overhead over running each mode individually is the response envelope only — under 10% in practice.

**Consequences:**
- ✅ Public surface stable at 38 tools through Phase 4. Phase 5 removes deprecated tools to settle around 32.
- ✅ Zero breaking change to `analyze`. A regression in any mode is caught by that mode's own test, not the wrapper's.
- ⚠️ A failure in any single mode would break a `Promise.all`. Mitigated by using `Promise.allSettled` and reporting `{mode, ok, error}[]`.

### 3. 30-day deprecation gate driven by telemetry

**Decision:** No public tool is removed without 30 days of `tool_token_usage` telemetry showing `callCount=0` for the candidate. Three stages: `advisory → warning → removed`, with `MCP_GRAPH_LEGACY_TOOLS=on` as an emergency rollback.

**Rationale:**
- Without data, removal is a guess. The four candidates total ~1.1k LoC; reverting that on a customer report is more expensive than waiting 30 days.
- Telemetry is cheap. Phase 1 added three nullable columns (`success`, `duration_ms`, `error_kind`) and a fail-silent middleware. Two days of work returns 30 days of evidence.
- The three-stage progression mirrors graceful-degradation patterns: do less, then warn, then deny. Each stage gives users a window to react before the next one takes effect.
- The rollback flag and per-removal commit isolation make `git revert` trivial if a candidate turns out to be load-bearing for an unmeasured workflow.

**Consequences:**
- ✅ Removal decisions become auditable: `metrics({mode: "tool_usage", sinceDays: 30})` shows the data behind each call.
- ✅ Reversal path is one env var or one commit revert.
- ⚠️ Phase 5 sits 30 days behind Phase 1's merge. Acceptable: Phases 0–4 deliver the maestro itself; Phase 5 is cleanup, not on the critical path.
- ⚠️ A tool used once a month would show `callCount=0` over a 30-day window. Mitigated by manual review before each transition; the gate is a *necessary* condition, not sufficient.

## Status in the graph

The PRD that drove this ADR is tracked locally in the workflow graph (`workflow-graph/graph.db`); design rationale stays internal per the project's "No public design exposure" rule. The implementation is split across the V11 Maestro PR series (Phases 0–5 + mode telemetry/deprecation) and the Copilot Bridge work that consumes the plan-payload contract for browser automation.

## References

- `src/core/browser-harness/llm-planner.ts` — pre-existing `PlanResponseSchema` that the Phase 4 `PlanPayloadSchema` generalizes
- `src/mcp/contracts/plan-payload.ts` — the V11 Maestro Phase 4 contract
- `src/mcp/deprecated-tools.ts` and `src/mcp/deprecated-modes.ts` — the gate infrastructure
- `docs/migration/v11-maestro-surface.md` — operator migration guide
