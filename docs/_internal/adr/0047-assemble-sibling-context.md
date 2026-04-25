
# ADR-0047 — `assembleSiblingContext` topological + token-budget + ready-to-prompt rendering

> **Conflict note:** the existing file `docs/_internal/adr/0050-ink-cli.md` predates this draft. Renumber that to `0056-ink-cli.md` (next available after 0054 capability gate, 0055 reserved here for sibling-context). Or assign this ADR a different number — adjust before copy.

- **Status:** Accepted (retro-documenting code already shipped, 2026-04-25)
- **Driver:** v11 context-pollination — `start_task` injects prior-subtask context into the next subtask's prompt, requiring a deterministic ordering, a hard token budget, and a canonical rendering format.
- **Owner:** @diegonogueira
- **Supersedes/replaces:** phantom citations `ADR-v11-003`, `ADR-v11-004`, `ADR-v11-006` (referenced from `src/core/pipeline/assemble-sibling-context.ts` and tests; no files exist under `docs/_internal/adr/` for them). Collapsed into this single ADR because the three concerns are tightly coupled in the same function.

## Context

`assembleSiblingContext(store, { epicId, subtaskId, tokenBudget? })` is called by `start_task` (line 312, `src/core/pipeline/start-task.ts`) every time an agent picks up a subtask. It returns a markdown blob to inject into the prompt: "here is what your siblings produced before you started."

Three sub-decisions live inside this function:

1. **Ordering** (ADR-v11-003 phantom) — what order do siblings appear in?
2. **Truncation** (ADR-v11-004 phantom) — how do we keep the markdown under the model's context budget?
3. **Rendering** (ADR-v11-006 phantom) — how do we structure the markdown so the next agent treats it as canonical context, not as instructions?

Each was decided as the function was built; this ADR records the rationale.

## Decision

### 1. Ordering — topological sort with `created_at` tiebreak, fallback warning

Siblings come from the `subtask_artifacts` table (ADR-0046) for the same `epic_id`. They are ordered by:

1. Topological sort over `depends_on` edges between subtasks (`src/core/pipeline/assemble-sibling-context.ts` `topologicalSort` via Kahn's algorithm).
2. Tiebreak among nodes with no remaining incoming edges: `created_at` ASC, then `id` ASC.
3. **Cycle detection**: if `topologicalSort` returns null, log a `WARN sibling_context.cycle_detected` event and fall back to pure `created_at` ordering. The agent still receives context — degraded but non-empty.
4. **Missing edges fallback**: if a subtask has no `depends_on` edges, log `WARN sibling_context.no_deps_fallback` and include all done siblings in `created_at` order.

**Why topological + created_at tiebreak:** the receiving agent should see prerequisites BEFORE dependents in the prompt. Plain `created_at` ordering would fail when subtask B (created at T+1, depends on subtask A from T+0) shows up before A — agent reasons about B without seeing A's contract.

### 2. Truncation — token budget 4000 default, oldest-first dropped

```ts
const DEFAULT_TOKEN_BUDGET = 4000;
```

After topological ordering, each rendered sibling is fed through `estimateTokens()` (per the canonicalization budget, not the model tokenizer). When the running total exceeds `tokenBudget`:

- Drop the **oldest** sibling first (the head of the topological order).
- Re-render and re-estimate. Iterate until under budget.
- Track `truncatedCount` in the response so callers can warn the user when ancestors were lost.

**Why 4000 default:** empirically chosen to leave ≥4000 tokens for system prompt + user task + completion in models with 8k–32k context. Caller can override per-call (`{ tokenBudget: 8000 }`) when the model has wider context.

**Why oldest-first dropped (not newest-first):** the receiving agent's IMMEDIATE predecessors (most recent siblings) are most likely to encode the function signatures and types it needs to consume. Dropping the oldest preserves the "near context" at the cost of losing distant ancestor context first. This trades correctness on long chains (lose context on the first 2/10 siblings) for correctness on short chains (no loss).

**Alternative considered**: drop "least relevant" via cosine sim against the receiving subtask's title. Rejected: adds an embedding dependency, and "relevance" can drop a critical interface (e.g., the type used three siblings ago).

### 3. Rendering — `### Subtask N: title` + fenced artifacts, language-aware fences

Each sibling renders as:

```markdown
### Subtask {id}: {title}

**file** — {path}
\`\`\`{lang}
{content}
\`\`\`
**diff** — {path}
\`\`\`diff
{content}
\`\`\`
**decision** — {path or null}

{content}
```

Where `{lang}` is chosen by `fenceLang(kind, path)`:

- `kind === "diff"` → `diff`
- `kind === "file" | "interface"`: `python` if `.py`, `go` if `.go`, `rust` if `.rs`, default `ts`
- `kind === "note" | "decision"` → no fence (plain markdown)

The header `### Subtask {id}: {title}` is **not** a heading the next agent should mimic — it's a context delimiter. Convention enforced via downstream prompt instructions.

**Why this format:**

- Fenced blocks distinguish content from prose unambiguously.
- Per-kind label (`**file**`, `**diff**`, `**decision**`) lets the agent recognize which section is binding (file = canonical signature, decision = rationale, note = optional).
- `### Subtask N` heading delimits siblings even after token-budget truncation.

**Known limit (informs ADR-0054 v2 implementation_bound finding):** this rendering keeps only the canonical artifacts deposited via `subtask_artifacts` store. It DOES NOT preserve the model's prose/reasoning between artifacts. H12 (eva-agent) showed Haiku at 50% with raw-output prompt-injection vs 20% via this structured-only rendering — gap is implementation-bound. Fix candidate: add `kind: "raw_output"` artifact to preserve prose, or extend the rendering to optionally include a `**reasoning**` section.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Plain `created_at` ordering (no topological)** | Breaks dependency-direction in prompt; agent reasons about dependent before prerequisite. |
| **No truncation; let model error on overflow** | Hard fail mode; better to gracefully degrade with a tracked `truncatedCount`. |
| **JSON instead of markdown rendering** | Models trained on natural language; markdown closer to expected context format than `{...}`. |
| **Preserve raw model output as primary** | Loses canonical type/path info; encourages agent to mimic predecessor prose verbatim (overfit). H12 evidence suggests we should add this as supplement (raw_output kind), not replace. |

## Consequences

**Positive:**

- Deterministic output for a given `(epicId, subtaskId, tokenBudget)` triple.
- Clean type-aware rendering for the receiving agent.
- Graceful degradation under cycles or missing edges.

**Negative / mitigations:**

- **Lost prose** (the H12 finding) — receiving agent doesn't see WHY each predecessor made its choices. Mitigation: ADR-0054 v2 advisory + roadmap to add `raw_output` kind.
- **Truncation drops context** — for chains > 5 siblings × ~800 tokens, ancestors are lost. Mitigation: caller can pass higher `tokenBudget`; 11.0.0 considers raising default to 8000 for high-context models.
- **Markdown can be parsed back as instructions by the agent** — mitigation: prompt-engineering convention + `### Subtask` heading is delimiter-style, not user-facing.

## Verification

- `src/tests/pipeline/assemble-sibling-context.test.ts` covers: empty siblings, single-sibling, topological cycle, token-budget truncation, missing-edges fallback.
- `src/tests/pipeline/start-task-sibling-context.test.ts` covers integration with `start_task`.
- `src/tests/agent-format-sibling-context.test.ts` covers rendering format snapshot.

## References

- `src/core/pipeline/assemble-sibling-context.ts` (implementation)
- `src/core/pipeline/start-task.ts` (caller)
- `src/core/store/subtask-artifacts-store.ts` (data source)
- ADR-0046 (`subtask_artifacts` store)
- ADR-0054 v2 (capability gate; this rendering is what the gate gates)
- `~/eva-agent/data/evo/experiments/h12-capability-feature-interaction/result.md` (sim/real gap finding)
- `~/eva-agent/notes/v11-drafts/H12-research-followup.md` (raw_output fix candidate)
