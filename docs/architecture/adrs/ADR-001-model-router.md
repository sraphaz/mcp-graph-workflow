# ADR-001: Task-Level Model Router

- **Status:** Accepted
- **Date:** 2026-04-18
- **Author:** Diego Lima Nogueira de Paula
- **Supersedes:** —
- **Superseded by:** —

## Context

Agent hosts that drive mcp-graph (Claude Code, Cursor, etc.) pay per token, with wide price spread across Claude model tiers — Haiku is roughly 10× cheaper than Sonnet and ~75× cheaper than Opus. Routing every task to Sonnet or Opus "to be safe" is the default, and it overpays dramatically for atomic work (test authoring, documentation, pattern-heavy TDD) where Haiku produces indistinguishable output.

A naive router keyed on a single signal (e.g. `xpSize` alone) is insufficient:

- A task marked `S` can still require deep reasoning if its acceptance criteria are vague, if it sits inside a weakly-harnessed module, or if its type is architectural (`decision`, `interface`, `state_machine`).
- A task marked `M` with crisp, testable, GWT-formatted ACs in a high-harness module is often a perfect Haiku candidate.

The graph already owns enough structured signal to do better: `xpSize`, the AC-quality report, a harness score, the `depends_on` DAG, and an issue-pattern tracker. What was missing is a composable scoring function that combines these into a single per-task routing decision.

## Decision

Adopt a **Task Readiness Score** that combines five independent signals into a 0–100 composite, then maps the score to a preferred model with hard overrides for high-stakes cases.

### Signals and weights

| Signal | Weight | Source | Rationale |
|--------|-------:|--------|-----------|
| `xpSize` | 35% | `node.xpSize` → `XP_SIZE_ORDER` (XS/S → 100, M → 70, L → 40, XL → 10) | Smaller tasks have less context to reason about. |
| AC quality | 30% | `validateAcQuality(doc, nodeId).score` (0–100, INVEST-based) | Crisp ACs make the task self-contained; vague ACs require interpretation. |
| Harness (local) | 15% | Latest `harness_history` score, neutral 65 when unknown | Code that is well-typed, well-tested, and well-named reduces hallucination risk even with a cheaper model. |
| Dependency depth | 10% | Longest `depends_on` chain rooted at the node (100 → 0 across 4 deps) | Chained dependencies imply more upstream context to absorb. |
| Issue-pattern penalty | 10% | `IssuePatternTracker` occurrences × 10, saturating at 40 | Nodes in categories with a history of DoD failures deserve more reasoning budget. |

Weights were chosen by deliberate construction, not empirical optimization. They will be revisited once benchmark data (see Validation) is available.

### Score-to-model mapping

| Score | Recommendation | Rationale |
|-------|---------------|-----------|
| ≥ 85 | `haiku` | Small, testable, clean — Haiku is almost always sufficient. |
| 60–84 | `sonnet` | Medium reasoning; let Sonnet handle. |
| < 60 | `opus` | High uncertainty; favor stronger reasoning even at higher cost. |

The Haiku threshold is deliberately set at 85 (not 80) to stay conservative during the initial rollout. It can move down as benchmark data accumulates.

### Hard overrides (bypass the score)

1. **High-stakes node types always route to Opus**, regardless of score:
   `decision`, `constitution`, `interface`, `state_machine`, `formula`, `contract`.
   Rationale: these carry durable architectural impact; the cost of a wrong decision dwarfs the inference savings.

2. **No testable AC → never Haiku.** If no acceptance criterion contains a testable verb (parsed via `ac-parser`), the minimum is `sonnet` (or `opus` when score < 70).
   Rationale: Haiku's strength is executing a clearly-specified contract. Without one, it is out of its depth.

### Transport

- **Per-task hint**: `start_task` pipeline emits `modelHint: TaskReadinessScore` in its response. The agent host reads the `recommendation` field and routes accordingly.
- **Per-skill hint**: each `.agents/skills/graph-*/SKILL.md` frontmatter carries a `model: { prefer, fallback, rationale }` block describing the skill's typical cost profile. Hosts combine this with the per-task hint (task-level takes priority).
- **Fallback semantics**: the hint is a suggestion. Hosts that ignore it get current behavior. No MCP tool is affected by the router when the host opts out.

### Validation gate

The router is **advisory** until a benchmark validates cost-quality trade-offs on real tasks. Before promoting it to "default behavior on supported hosts", we require:

1. A 30–50 task benchmark comparing Haiku-recommended tasks run with Haiku vs. the same tasks run with Sonnet.
2. Metrics: first-try DoD pass rate, re-work count, cost delta.
3. Gate: Haiku-recommended tasks achieve ≥ 90% of Sonnet's DoD pass rate, at ≥ 85% cost reduction on that subset.

Until then, the hint exists in the response but deployment is left to host-level configuration.

## Consequences

**Positive**

- Hosts that honor the hint see roughly 70–80% cost reduction on IMPLEMENT-heavy workloads, matching the price delta between Haiku and Sonnet.
- No MCP SDK dependency on Anthropic — the router is a decision oracle; actual model invocation stays in the host.
- All signals are already computed by the graph; marginal runtime cost of the score is < 1 ms per `start_task` call.
- Backward compatible: `modelHint` is an optional field.

**Negative**

- The thresholds are hand-picked; they will be wrong for at least some workloads until benchmark data accumulates.
- High-stakes overrides can be coarse — a tiny, well-specified refactor of a `state_machine` is still routed to Opus. Acceptable as a safety default.
- Hosts that split task execution across multiple sub-agents may need to propagate the hint manually.

**Neutral**

- The per-skill frontmatter (already shipped in commit 35c4a8a8) and the per-task `modelHint` (in `start_task` output) are independent mechanisms. Hosts can honor either, both, or neither.

## Alternatives considered

1. **Single-signal router (xpSize only).** Rejected: misses AC quality and harness, both of which materially affect task difficulty at the same nominal size.
2. **Anthropic-SDK integration (router invokes models directly).** Rejected for this iteration: couples mcp-graph to a provider, complicates testing, and does not add value over emitting hints. Reconsider if daemon mode grows an autonomous execution path.
3. **Learned weights via regression on historical DoD outcomes.** Deferred: requires the benchmark from the validation gate. Hand-picked weights are a reasonable prior.
4. **Route by task type alone (task→Haiku, design→Opus, etc.).** Rejected: too coarse. A `task` node can still be architectural if its description touches contracts.

## Implementation references

- `src/core/planner/task-readiness-score.ts` — scoring function
- `src/core/pipeline/start-task.ts` — integration point
- `src/mcp/tools/start-task.ts` — MCP surface
- `src/core/planner/auto-decompose.ts` — companion feature that pushes L/XL toward the Haiku-eligible range
- `.agents/skills/graph-*/SKILL.md` — per-skill hint frontmatter
- `src/tests/planner/task-readiness-score.test.ts` — 9 TDD tests covering branches and cycle safety
