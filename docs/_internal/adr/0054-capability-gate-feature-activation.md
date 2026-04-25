# ADR-0054 — Capability gate (advisory) + implementation fix priority for `assembleSiblingContext`

> **Draft v2** — copy to `/Users/diegonogueira/mcp-graph-workflow/docs/_internal/adr/0054-capability-gate-feature-activation.md` when ready.
> Style mirrors ADR-0053 (cli-surface). v1 of this draft assumed `capability_gate_justified` verdict; H12 (eva-agent designHash `4e41e13d43d4`, run 2026-04-25) verdict was `INDICATIVE_implementation_bound`. v2 redrafts the decision accordingly.

- **Status:** Accepted (2026-04-25, pending H12-main replication for GA promotion)
- **Driver:** v11 release gate decision — `BENCHMARK-v11.md` Haiku 40pt regression, refuted as capability bottleneck by H12 cross-family pilot
- **Owner:** @diegonogueira
- **Supersedes:** the phantom citation `ADR-v11-007` referenced from `docs/_internal/BENCHMARK-v11.md` (no file ever existed under `docs/_internal/adr/`).

## Context

The v11 release introduces `assembleSiblingContext()` — runtime injection of prior-subtask outputs into `start_task` responses, designed to fix the fragment-collision failure mode observed when small models decompose code-generation tasks across siblings.

Four empirical signals constrain how this feature ships:

### Signal 1 — Real implementation benchmark (`BENCHMARK-v11.md`, designHash `bb536843fcce`)

| Arm | Model | Pass rate | Δ vs Haiku mono |
|---|---|---|---|
| A (mono) | claude-haiku-4.5 | 60.0% | (baseline) |
| B-v2 (decomp + pollination) | claude-haiku-4.5 | **20.0%** | **−40 pts** |
| C (mono Sonnet) | claude-sonnet-4.6 | 80.0% | n/a |

The v2 feature regresses Haiku 40 points. Originally read as capability ceiling.

### Signal 2 — eva-agent H8 final verdict (`negative_friction`, N=20)

External corroboration: graph-ritual vs free-CLI matched-pair on 20 coding tasks. wall_clock d=+1.01, tokens d=+0.76 (Bonferroni-significant); correctness tied 20/20. Reading: structured decomposition imposes overhead that small/mid models cannot amortize into quality.

### Signal 3 — eva-agent H9v2 simulation ceiling (`5/5 pass`, designHash `3e37f301e7be`)

H9v2 manually injected prior-subtask outputs via prompt — i.e. simulated a perfect `assembleSiblingContext` — and obtained 5/5 tests pass on Haiku 4.5. Caveat (post-hoc 2026-04-25): this is the **upper bound** with perfect injected context, not what the v11 implementation delivers.

### Signal 4 — eva-agent H12 cross-family pilot (designHash `4e41e13d43d4`, run 2026-04-25)

Replicated the H9v2 prompt-injection protocol on a 5-model × 2-condition × 3-seed grid via OpenRouter. Verdict per pre-registered rule: **INDICATIVE_implementation_bound** (T3 mean(decomp) 0.25 ≥ T3 mono−0.10).

Decisive Haiku data point:

| Source | Method | Haiku decomp+poll pass rate |
|---|---|---|
| H9v2 sim | Claude Code Agent + prompt-injection | **100%** (5/5) |
| BENCHMARK-v11 real | Real `assembleSiblingContext` | **20%** (1/5) |
| H12 sim | OpenRouter + prompt-injection | **50%** (3 seeds × 1 task) |

The 30-point gap between H12 sim (50%) and BENCHMARK-v11 real (20%) is **implementation-bound** — capability ceiling alone cannot explain it, since prompt-injection delivers significantly higher Haiku quality than the real implementation does.

The remaining 50-point gap between H12 sim (50%) and H9v2 sim (100%) is likely Claude-Code-internal harness (system prompts, RAG, context priming) that bare OpenRouter doesn't replicate.

H12 caveats: N=3 seeds × 1 task is INDICATIVE not CONFIRMED. T2 llama-70b decomp 0% (vs mono 40%) is an unexplained anomaly. T1 reasoning models had 5/30 length-truncations affecting their means. Full discussion in `~/eva-agent/data/evo/experiments/h12-capability-feature-interaction/result.md`.

## Decision

Ship v11 with a **two-track approach**:

1. **Implementation fix priority** — debug `assembleSiblingContext` real-impl path that regresses Haiku-class models 30pts vs prompt-injection. Likely candidates: context truncation, RAG retrieval quality, sibling-output canonicalization. Track in `tools/cli/src/runtime/sibling-context-impl.ts` (and wherever the real call site lives).
2. **Advisory capability gate as fallback** — keep `tools/cli/src/runtime/capability-gate.ts` runtime API and tier table, but default behavior is **advisory** (warning emit, feature stays ON) rather than blocking (default-OFF for T3). The blocking version stays available behind `MCP_GRAPH_GATE_STRICT=1` for users who hit the implementation bug while it's being fixed.

### Tier table (canonical — `tools/cli/src/runtime/capability-gate.ts`)

| Tier | Models (non-exhaustive) | Default behavior for `assembleSiblingContext` (post-fix) | Strict mode behavior |
|---|---|---|---|
| **T1 — high reasoning** | `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `gpt-5*`, `deepseek-r1*`, `qwen3-235b-a22b-thinking` | **ON** | **ON** |
| **T2 — capable mid** | `claude-sonnet-4-5`, `gpt-4o`, `gpt-4-turbo`, `mistral-large` (≥ 70B), `llama-3.3-70b` | **ON** with telemetry | **ON** with telemetry |
| **T3 — small / quantized** | `claude-haiku-4-5`, `claude-haiku-3-5`, `gpt-4o-mini`, `gpt-3.5-turbo`, `mistral-7b`, `llama-3-8b` | **ON** with structured warning ("known degraded; H12-main pending") | **OFF** with structured warning |
| **T4 — unknown** | any `model_id` not in the table | **OFF** + `capability_lookup_miss` log | **OFF** + log |

### What changed from v1 of this ADR

Originally proposed (assuming `capability_gate_justified`): **default-OFF for T3, opt-in via env**. Inverted by H12 to: **default-ON with advisory warning** for T3, **default-OFF only in strict mode** (`MCP_GRAPH_GATE_STRICT=1`). The tier table identity is preserved, but the gate's enforcement default flips from "block" to "advise + telemetry".

### What the gate is NOT

- **Not a substitute for the implementation fix.** Shipping ADR-0054 advisory + fix-priority does NOT mean the gate is permanent. If H12-main (N≥10, planned post-beta) confirms `implementation_bound`, the strict-mode default may be removed entirely once the fix lands.
- **Not a license to ignore the BENCHMARK-v11 regression.** The 40pt Haiku gap is an acknowledged bug; users on production paths should use Sonnet+ until the fix ships.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **v1 of this ADR (default-OFF for T3 = capability gate strict)** | H12 evidence (Haiku decomp+poll 50% via sim vs 20% via real impl) suggests capability is not the bottleneck. Gate-strict would mask the real implementation bug. |
| **Ship 11.0.0 GA per phantom `ADR-v11-007`** | The cited ADR does not exist. The reframing (gates pass structurally, not algorithmically) conceals a 40-point regression. |
| **Block release until implementation fix lands** | Implementation fix may take iterations; meanwhile ~250 downstream tasks (cli pkg + Track 1) stay blocked. Beta release with advisory + fix-priority unblocks the pipeline while the fix is in flight. |
| **Drop the gate entirely; rely solely on implementation fix** | Insufficient evidence to commit. T2 llama-70b decomp 0% anomaly + N=3 H12 = the gate-as-fallback hedge. Re-evaluate post H12-main. |

## Consequences

**Positive:**

- v11.0.0-beta.0 ships immediately with empirical foundation (H12 commits `baca96e`, `85d6e8e`, `a8c724a`, `23de7fd`).
- T3 users get the feature with a clear warning instead of silent disable; opt to strict mode if the warning matches a real failure.
- Fix priority on `assembleSiblingContext` real impl is documented and tracked.
- The Haiku 30pt sim/real gap is preserved as empirical input to H12-main (planned, N≥10/cell pre-GA).

**Negative / mitigations:**

- **Production users on Haiku may hit the bug.** Mitigation: structured warning in logs explicitly names ADR-0054 and BENCHMARK-v11; release notes recommend Sonnet+ for production until fix.
- **Strict-mode env adds API surface.** Mitigation: documented as debug/escape-hatch in CHANGELOG and `mg help`.
- **Tier table will drift** as models ship. Mitigation: tier table sourced from `capability-gate.ts`; ADR-0054 references it and is updated in the same PR.
- **H12 N=3 is INDICATIVE.** Mitigation: H12-main planned (commit gate before any 11.0.0 GA tag).

## Verification

- `rg -F 'ADR-v11-007' /Users/diegonogueira/mcp-graph-workflow` returns zero matches after release commit.
- Unit test fixtures in `tools/cli/src/runtime/capability-gate.test.ts`:
  - `model_id="claude-haiku-4-5"` (default mode) → feature ON + warning log
  - `model_id="claude-haiku-4-5"` (`MCP_GRAPH_GATE_STRICT=1`) → feature OFF + warning log
  - `model_id="claude-sonnet-4-6"` → feature ON, no warning
  - `model_id="bogus-model"` → feature OFF + `capability_lookup_miss` log
- Re-run `BENCHMARK-v11.md` Arm B-v2 with implementation fix; expected outcome: Haiku ≥ 60% (mono baseline parity).
- H12-main pre-registered + run before any 11.0.0 GA tag.

## References

- `docs/_internal/BENCHMARK-v11.md` (Arm A/B-v2/C, designHash `bb536843fcce`)
- `~/eva-agent/data/evo/experiments/h9v2-context-pollination/result.md` (sim ceiling 100%, post-hoc caveat 2026-04-25)
- `~/eva-agent/data/evo/experiments/h12-capability-feature-interaction/result.md` (designHash `4e41e13d43d4`, INDICATIVE_implementation_bound, run 2026-04-25)
- eva-agent memory: `project_h12_capability_feature_interaction.md`
- eva-agent memory: `project_h8_final_verdict_negative_friction.md` (graph-ritual friction d=1.01)
- eva-agent memory: `project_v11_tier1_cross_family_confirmed.md` (basis for T1 cross-family inclusion)
- ADR-0053 (CLI surface — companion ADR for v11)
- Plan: `~/.claude/plans/jaunty-pondering-bee.md` (release decision plan)
