# ADR-0058 — Feature-depth strict mode (gate promotion)

- **Status:** Accepted (2026-04-26)
- **Driver:** Phase E of the feature-depth lifecycle integration. Advisory warnings alone don't change behavior; teams that want closed-loop quality enforcement need the option to make regressions block `finish_task`.
- **Owner:** @diegonogueira
- **Related:** lifecycle integration commits 28ec387 → 6b4e32b (PR 262 stack)

## Context

The feature-depth check (introduced in 019e7e6, reinforced by 0193668/7486ac9/6b4e32b) measures per-file score regressions on every `finish_task`, UPSERTs baselines, and writes memory entries on positive quadrant crossings. Until this ADR the gate was **advisory-only**: warnings appeared in `result.featureDepth.warnings` but never reached `result.blockers`, so no task was blocked by a feature-depth regression.

Three real-world signals drive the need for an opt-in strict mode:

1. **Empirical waste accumulates silently.** A team that ignores warnings for a sprint accumulates regressions; the next sprint inherits SHALLOW files that were MATURE three weeks ago. The advisory channel is too easy to dismiss.
2. **Some teams are ready for hard enforcement.** Mature codebases with established baselines want the same shift-left treatment that test-gate and harness-gate already get.
3. **The signal is asymmetric.** A single file regressing > 5pts is almost always meaningful (delete a test, add `any`, swallow an error); false positives are rare. The cost of one wrong block is small, the value of catching real regressions is high.

The codebase already had the pattern: `codeIntelligence: "strict" | "advisory" | "off"`, `prerequisites: "strict" | "advisory" | "off"`. Feature-depth gets the same surface.

## Decision

Add `featureDepth: "strict" | "advisory" | "off"` to `set_phase` input, persisted as `feature_depth_mode` in `project_settings`. The setting is read by `runFeatureDepthCheck` at every invocation:

| Mode | What happens to regressions |
|---|---|
| `off` | check is skipped entirely — no scoring, no UPSERT, no memory writes |
| `advisory` (default) | warnings populate `report.warnings`, `report.blockers` is empty, `finish_task` proceeds |
| `strict` | warnings populate BOTH `report.warnings` and `report.blockers`; `finish_task` aggregates `report.blockers` into its top-level `blockers` array, so the task moves to `blocked` status |

`advisory` is the default because (a) existing projects shouldn't suddenly start blocking after upgrading mcp-graph, and (b) baselines need a few `finish_task` cycles to populate before strict mode is meaningful — running strict on day one would block on every fresh file.

### Threshold

The threshold for "regression" stays at the existing `DEFAULT_REGRESSION_THRESHOLD = 5pts` defined in `regression-gate.ts`. A regression smaller than 5pts never produces a warning, so strict mode never blocks on noise.

### Memory writes & baseline UPSERT

Both still happen in `advisory` and `strict`. Only `off` skips them. Reasoning: the memory-of-deepening narrative and the per-file baseline are valuable independently of the gate decision — turning the gate off shouldn't erase history.

### Set-phase wiring

`setPhaseCore` now writes `feature_depth_mode` whenever the caller passes `featureDepth`, mirroring the `codeIntelligence` and `prerequisites` blocks. The MCP `set_phase` tool's schema gains the same enum.

## Consequences

- ✅ Teams can opt into closed-loop quality enforcement with one MCP call: `set_phase({ featureDepth: "strict" })`.
- ✅ Default behavior unchanged. Upgrading mcp-graph never unexpectedly blocks anyone.
- ✅ The feature-depth report (`result.featureDepth`) now exposes the active mode, so consumers (dashboard, audit log) can attribute decisions correctly.
- ⚠️ Strict mode requires established baselines to be useful. Document that the recommended adoption path is: run advisory for ~1-2 sprints to populate `feature_depth_baselines`, then promote to strict.
- ⚠️ Regressions on legitimately deprecated files (`feat!` removing tests intentionally) need a manual override. The existing `force: true` finish-task escape hatch covers this — same pattern as test-gate and contract-gate. Not new escape hatch ceremony.

## Verification

- `src/tests/feature-depth-strict-mode.test.ts` (5 tests) — covers default-advisory, explicit-advisory, strict-promotes, strict-no-regression-still-passes, off-short-circuits.
- `src/tests/feature-depth-*.test.ts` (10 files, 73 tests cumulative) — backward-compat matrix.
- `src/tests/pipeline/finish-task.test.ts` (7 tests) — finish_task regression untouched.
- Manual: `set_phase({ featureDepth: "strict" })` then `finish_task` on a node touching a regressed file → `result.status === "blocked"` and `result.blockers` contains the feature-depth message.
