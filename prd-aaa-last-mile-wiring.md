# PRD: AAA+ Last Mile — Wiring 20 Modules into the Pipeline

## Context

We implemented 20 AAA+ modules (5,046 lines, 126 tests) across 4 phases, but **exploration revealed they exist in isolation**. None are wired into the actual MCP pipeline execution flow. The modules pass unit tests individually but the pipeline (`start_task → finish_task`) doesn't use them.

This PRD closes the "last mile" gap, transforming the AAA+ architecture from tested components into an operational autonomous agent system. Each gap maps to the **M.A.P.A. methodology** from the blog article "Alucinação vem do código, não do modelo."

## Gap Summary

| # | Gap | Severity | M.A.P.A. | Files to Modify |
|---|-----|----------|----------|-----------------|
| 1 | `finish_task` doesn't call `runTestGate()` | **CRITICAL** | A (Gates) | `pipeline/finish-task.ts` |
| 2 | `start_task` doesn't use `TaskPrefetcher` | **CRITICAL** | P (Pipeline) | `pipeline/start-task.ts`, `planner/index.ts` |
| 3 | `set_phase` doesn't use `AutopilotBridge` | **CRITICAL** | A (Gates) | `mcp/tools/set-phase.ts` |
| 4 | `context-assembler` uses hardcoded 60/30/10 budget | HIGH | M (Contracts) | `context/context-assembler.ts:116-118` |
| 5 | `context-assembler` never calls AST pruning | HIGH | P (Pipeline) | `context/context-assembler.ts:~140` |
| 6 | No cache invalidation on phase changes | HIGH | A (Gates) | `mcp/tools/set-phase.ts:~125` |
| 7 | `citation-chain` never builds provenance | HIGH | M (Contracts) | `context/context-assembler.ts:~196` |
| 8-10 | No dashboard tabs for autopilot/contracts/budget | MEDIUM | A (Audit) | New files in `web/dashboard/` |
| 11 | No REST API for autonomy module | MEDIUM | A (Audit) | New `api/routes/autonomy.ts` |
| 12 | No E2E integration tests | LOW | P (Prove) | New test file |

---

## Sprint 1: Critical Pipeline Wiring (Gaps 1-3)

### Task W-01: Convert finishTask to async + wire runTestGate() [M]
**Size:** M | **Priority:** 1 | **File:** `src/core/pipeline/finish-task.ts`

**Changes:**
1. Convert `finishTask()` from sync to `async` (returns `Promise<FinishTaskResult>`)
2. Import `runTestGate` from `../harness/test-gate.js`
3. After DoD checks (~line 174), before status update:
   - Get mode from `store.getProjectSetting("test_gate_mode") ?? "advisory"`
   - Call `await runTestGate(store, nodeId, mode)`
   - If strict + failed → add blocker `"test_gate: N test(s) failed"`
4. Add `testGate?: TestGateResult` to `FinishTaskResult` interface
5. Cascade `await` to caller in `src/mcp/tools/finish-task.ts:26` (already async)
6. Update existing tests to use `await finishTask()`

**Backward compat:** Mode defaults to `"advisory"` → reports but doesn't block. Nodes without testFiles → gate skips.

**AC:**
- `GIVEN node with testFiles and failing tests in strict mode WHEN finishTask() THEN status remains in_progress with test_gate blocker`
- `GIVEN node without testFiles WHEN finishTask() THEN behavior identical to current (no gate)`

---

### Task W-02: Wire TaskPrefetcher into start-task + finish-task [M]
**Size:** M | **Priority:** 1 | **Depends:** W-01 | **Files:** `pipeline/start-task.ts`, `pipeline/finish-task.ts`, `planner/index.ts`

**Changes:**
1. Export `TaskPrefetcher` from `src/core/planner/index.ts`
2. Create module-level singleton in `start-task.ts`: `const prefetcher = new TaskPrefetcher({ ttlMs: 5 * 60 * 1000 })`
3. In `startTask()` at line ~97, before `assembleContext()`:
   - Check `prefetcher.get(taskNode.id)` → if hit, skip RAG assembly
   - If miss, `prefetcher.invalidateIfMismatch(taskNode.id)`
4. In `finishTask()` after finding `nextTask` (~line 274):
   - Feed `prefetcher.prefetch(nextTask.id, { query, context })`
5. Add `prefetchHit?: boolean` to `StartTaskResult`
6. Export `prefetcher` for cross-module access

**AC:**
- `GIVEN finishTask completed task A and predicted task B WHEN startTask(B) THEN prefetchHit=true and latency < 500ms`
- `GIVEN user manually requests task C (not predicted) WHEN startTask(C) THEN prefetch cache invalidated, normal execution`

---

### Task W-03: Wire AutopilotBridge + cache invalidation into set_phase [M]
**Size:** M | **Priority:** 1 | **Independent** | **File:** `src/mcp/tools/set-phase.ts`

**Changes:**
1. Add Zod params: `autopilot: z.boolean().optional()`, `sprintId: z.string().optional()`
2. Import `AutopilotBridge` from `../../core/autonomy/autopilot-bridge.js`
3. Create module-level singleton: `const autopilotBridge = new AutopilotBridge()`
4. After phase is set, call: `autopilotBridge.handlePhaseChange(phase, autopilot, sprintId)`
5. Import `invalidateAssemblerCache` from `../../core/context/context-assembler.js`
6. On actual phase transition, call `invalidateAssemblerCache()`
7. Include `autopilotResult` and `cacheInvalidated` in response

**AC:**
- `GIVEN set_phase(IMPLEMENT, autopilot=true) THEN response includes autopilotActive=true + sessionId`
- `GIVEN set_phase without autopilot param THEN behavior identical to current`
- `GIVEN phase transition THEN assembler cache invalidated`

---

## Sprint 2: Context Engine Wiring (Gaps 4-7)

### Task W-04: Replace hardcoded budget with adaptive split [S]
**Size:** S | **Priority:** 2 | **File:** `src/core/context/context-assembler.ts:116-118`

**Changes:**
1. Import `getAdaptiveBudgetSplit` from `./adaptive-budget.js`
2. Replace hardcoded `Math.floor(tokenBudget * 0.6)` with:
   ```
   const split = getAdaptiveBudgetSplit(tokenBudget, store.getDb(), options?.phase ?? "IMPLEMENT", "B");
   const graphBudget = split.graphBudget;
   const knowledgeBudget = split.knowledgeBudget;
   ```
3. Add `_budgetSource?: string` to `AssembledContext`

**AC:** `GIVEN assembleContext() called THEN _budgetSource is "learned" or "default" or "fallback"`

---

### Task W-05: Wire AST pruning into context-assembler Tier 3 [S]
**Size:** S | **Priority:** 2 | **File:** `src/core/context/context-assembler.ts:~140`

**Changes:**
1. Import `pruneContextSection` from `./context-pruning.js`
2. After building graph sections, when `tier === "deep"`:
   - Extract query terms as `relevantSymbols`
   - Apply `pruneContextSection(content, queryTerms)` to code-like sections
   - Update token count with pruned content
3. Add `_pruning_stats` to response breakdown

**AC:** `GIVEN context(detail=deep) with TS file THEN _pruning_stats shows reductionPercent > 0`

---

### Task W-06: Wire citation chain into knowledge sections [S]
**Size:** S | **Priority:** 2 | **File:** `src/core/context/context-assembler.ts:~196`

**Changes:**
1. Import `extractCitationRefs` from `../rag/citation-chain.js` (type already imported)
2. After knowledge results are fetched (`kResults`), call `extractCitationRefs(kResults)`
3. Attach relevant citations to each knowledge section's `citations` field

**AC:** `GIVEN context with knowledge results THEN each section has citations: CitationRef[] (not undefined)`

---

## Sprint 3: Dashboard & API (Gaps 8-11)

### Task W-07: Autonomy REST API [M]
**New file:** `src/api/routes/autonomy.ts`

Endpoints: `GET /api/autonomy/status`, `GET /api/autonomy/session`, `GET /api/autonomy/budget`

### Task W-08: Autopilot dashboard tab [L]
**New file:** `src/web/dashboard/src/components/tabs/autopilot-tab.tsx`

Components: session status, confidence gauge, decision log, token budget pie chart

### Task W-09: Contract violations panel [M]
**Modify:** `src/web/dashboard/src/components/tabs/harness-tab.tsx`

Add section showing contract violations from finish_task responses

---

## Sprint 4: E2E Integration Test (Gap 12)

### Task W-10: Full pipeline E2E test [M]
**New file:** `src/tests/pipeline/e2e-aaa-pipeline.test.ts`

Tests complete flow: set_phase(autopilot) → startTask (prefetch) → finishTask (test gate + contract gate) → verify all M.A.P.A. pillars

---

## Dependency Chain

```
W-01 (finish-task async + test gate)
  ↓
W-02 (prefetcher wiring — feeds from finish-task)
                                          W-03 (set-phase autopilot — independent)
  ↓                                         ↓
W-04, W-05, W-06 (context engine — all independent)
  ↓
W-07, W-08, W-09 (dashboard/API — depend on wired data)
  ↓
W-10 (E2E test — depends on all)
```

## Key Design Decisions

1. **finishTask becomes async** — required because `runTestGate()` spawns vitest via child_process. Cascade limited to 2 call sites (MCP tool wrapper + tests), both already async.

2. **Module-level singletons** for TaskPrefetcher and AutopilotBridge — same pattern as existing `assemblerCache`. Ephemeral state that doesn't belong in SQLite.

3. **Adaptive budget defaults differ from current** — shifts from 60/30/10 to 35/30/25/10. Intentional: adds code + history budgets. Falls back gracefully when Q-Learning has insufficient data.

4. **AST pruning only on tier=deep** — default tier is "standard", so zero behavior change for normal context calls.

## Verification

1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — full suite passes, zero regressions
3. Manual: `set_phase(IMPLEMENT, autopilot=true)` → verify response has `autopilotActive`
4. Manual: `finish_task` with testFiles on failing test → verify blocker returned
5. Manual: `context(detail=deep)` → verify `_pruning_stats` and `_budgetSource` in response
