# H12 research followup — diagnostics + fix candidates

> Generated 2026-04-25 after H12 INDICATIVE_implementation_bound (commit 23de7fd). Two diagnostic dives + cleanup item.

## Diagnostic 1 — T2 llama-70b decomp 0% anomaly

**Root cause:** signature drift under decomp+pollination.

Llama-70b mono produces correct `fitPlattParameters(pairs: Array<[number, boolean]>): { A, B }`. Llama-70b decomp emits `fitPlattParameters(Nplus, Nminus)` returning `[A, B]` — wrong arity AND wrong return shape. Subsequent subtasks inherit the drifted signature, so `plattScale` (subtask 3) ends up calling a function that doesn't exist as expected.

**Cross-check Haiku decomp:** drifts to `fitPlattParameters(scores, labels)` — different drift, also wrong. Haiku still passes plattSigmoid tests (simplest, drift-free).

**Implication for ADR-0054:** the failure mode under decomp+poll isn't capability ceiling alone — it's also spec re-interpretation. Different models latch onto different (wrong) interpretations. Context-pollination amplifies the drift because subtask N+1 sees subtask N's wrong signature as canonical.

**Fix candidate:** pin signatures via the `interface` artifact kind in mcp-graph-workflow. If subtask 1 deposits `interface: signature.ts` with the canonical shape, subtask 2's prompt can include it as a constraint, not just text.

## Diagnostic 2 — Haiku 30pt sim/real gap

**Source files:**
- `src/core/pipeline/assemble-sibling-context.ts` — renders structured markdown
- `src/core/pipeline/start-task.ts` — calls assembleSiblingContext at line 312
- `src/core/store/subtask-artifacts-store.ts` — artifact storage

**What real impl does:**

```markdown
### Subtask {id}: {title}

**file** — packages/eva-core/src/metacognition/calibration.ts
```ts
{content}
```
**note** — {content}
**decision** — {content}
```

Pre-condition: each subtask DEPOSITS artifacts via `subtask_artifacts` store after completion. The next subtask's `start_task` retrieves them, topologically sorted with token-budget truncation (default 4000 tokens, oldest-first dropped).

**What H12 sim does:**

```text
=== Prior subtasks' outputs (use as canonical context) ===
--- Subtask 1 output ---
{raw model response — includes prose, headers, fenced blocks, all of it}
```

**The gap:** real impl strips the model's prose/reasoning, keeps only the canonical artifacts. H12 sim retains ALL of it. Hypothesis: Haiku-class models use the prose scaffolding to maintain spec coherence; structured-only context loses the natural-language signals that anchor function signatures and intent.

**Fix candidate (ablation-testable in mcp-graph-workflow):**

Add a `kind: "raw_output"` artifact. Each subtask deposits not just the structured artifacts but also the raw model response. `assembleSiblingContext` includes raw_output as an appendix to each sibling's structured render. Token budget already handles truncation.

```ts
// In renderSibling:
if (s.rawOutput) {
  artifactChunks.push(`**raw_output**\n\n${s.rawOutput}`);
}
```

Ablation:
- Run BENCHMARK-v11 with `assembleSiblingContext` returning structured-only (current) → expected: Haiku 20% (replication)
- Run with raw_output appendix → if Haiku ≥ 50% (matches H12 sim), hypothesis confirmed
- If still 20% → bug is elsewhere (token budget? canonicalization? RAG retrieval?)

**Caveat:** this is a hypothesis from comparing two artifact rendering pipelines. Other candidate bugs (truncation order, canonicalization stripping comments, RAG retrieval missing key spec lines) are not ruled out.

## Cleanup — Phantom ADRs (post-beta)

6 ADRs referenced in code/tests but absent from `docs/_internal/adr/`:

| ADR | Referenced in |
|---|---|
| ADR-v11-001 | `src/core/store/subtask-artifacts-store.ts` |
| ADR-v11-002 | `src/core/store/subtask-artifacts-store.ts`, `src/core/canonicalization/ts.ts` |
| ADR-v11-003 | `src/core/pipeline/assemble-sibling-context.ts` (topological sort), tests |
| ADR-v11-004 | `src/core/pipeline/assemble-sibling-context.ts` (token budget 4000) |
| ADR-v11-005 | `src/core/pipeline/finish-task.ts` |
| ADR-v11-006 | `src/core/pipeline/assemble-sibling-context.ts` (ready-to-prompt markdown), tests |
| ADR-v11-007 | `docs/_internal/BENCHMARK-v11.md` (release-policy, this is the original phantom) |

All have substantive design decisions encoded in code. Cleanup options:

1. **Write the 6 ADRs** based on the design decisions visible in code+tests. Best for auditability; ~1 day work.
2. **Replace references** with inline doc comments + link to specific code lines. Faster but loses ADR-style "why".
3. **Hybrid**: write ADR-v11-001 (subtask_artifacts), ADR-v11-006 (ready-to-prompt markdown) as priority since they're load-bearing for the v11 contract; defer the rest.

**Not a release blocker.** Beta can ship with phantoms in place; cleanup PR follows.

## Recommended next research

| # | What | Cost | Time | Output |
|---|---|---|---|---|
| 1 | **H12-main replication** N=10 seeds × 5 tasks × 5 models × 2 conditions = 500 cells | $20-50 | 2-3h parallel | CONFIRMED verdict, Bonferroni-significant |
| 2 | **Raw-output ablation in mcp-graph-workflow** | $1-3 | 1h | confirm/refute Haiku gap hypothesis |
| 3 | Investigate T2 anomaly with `interface` artifact pinning | $1-2 | 1h | confirm signature drift fix |

Order recommendation: (2) first — it's the smallest change with highest information for release decision. Then (1) for confirmation. (3) is optional cleanup.
