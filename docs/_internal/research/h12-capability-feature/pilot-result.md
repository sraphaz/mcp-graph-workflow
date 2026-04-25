# H12 — Capability×feature interaction probe RESULT

**Data:** 2026-04-25
**Design hash:** `4e41e13d43d4c932a807120d039222cd78fe83af72158bfc4e55a0c0c3dce883` (amended pre-data; see commits `baca96e` initial, `85d6e8e` slug-fix, `a8c724a` fixtures)
**Run wall:** 25.4 min (parallel cap=5)
**Run cost:** $0.4572

## Per-model pass rates (3 seeds/cell)

| Tier | Model | Mono | Decomp+poll | Δ (decomp − mono) |
|---|---|---|---|---|
| T1 | deepseek/deepseek-r1-0528 | 50% | 39% | -11pts |
| T1 | qwen/qwen3-235b-a22b-thinking-2507 | 20% | 33% | 13pts |
| T2 | meta-llama/llama-3.3-70b-instruct | 40% | 0% | -40pts |
| T3 | anthropic/claude-haiku-4.5 | 0% | 50% | 50pts |
| T3 | mistralai/mistral-7b-instruct-v0.1 | 0% | 0% | 0pts |

## By tier (mean of model means)

| Tier | Mean mono | Mean decomp | Mean Δ |
|---|---|---|---|
| T1 (high reasoning) | 35% | 36% | 1pts |
| T2 (capable mid) | 40% | 0% | -40pts |
| T3 (small) | 0% | 25% | 25pts |

## Verdict

**IMPLEMENTATION_BOUND** — T3 mean(decomp)=0.25 ≥ T3 mono−0.10 (-0.10). Small models handle decomp with injected context; BENCHMARK-v11's 40pt regression is implementation-bound. ADR-0054 is overcorrection — fix implementation, drop or relax gate.

## Decisive comparison: H12 Haiku decomp vs BENCHMARK-v11 Arm B-v2

| Source | Method | Haiku decomp pass rate |
|---|---|---|
| H9v2 sim ceiling (designHash 3e37f301e7be) | Prompt-injection | 100% (5/5) |
| BENCHMARK-v11 real (designHash bb536843fcce) | Real `assembleSiblingContext` | 20% (1/5) |
| **H12 (this experiment)** | Prompt-injection (matches H9v2) | **50%** |

Reading: H12 Haiku decomp falls between H9v2 (100%) and BENCHMARK-v11 (20%) — partial capability deficit, real impl amplifies. Mixed mechanism; needs N≥10 to disambiguate.

## Run summary

- Tasks: 30 (cells × seeds)
- Errors (any subtask failed): 5
- Tokens in: 92,898
- Tokens out: 219,059

## Pre-registered verdict mapping

See `design.json` §verdictMapping. Decision rule applied above.

## Cross-references

- `data/evo/experiments/h9v2-context-pollination/result.md` (sim ceiling 5/5; post-hoc caveat 2026-04-25)
- `~/mcp-graph-workflow/docs/_internal/BENCHMARK-v11.md` (real impl Arm B-v2 20%)
- `~/mcp-graph-workflow/docs/_internal/adr/0054-capability-gate-feature-activation.md` (ADR draft pending H12)
- Plan: `/Users/diegonogueira/.claude/plans/jaunty-pondering-bee.md` (Track B in plan, executed pre-Track A.7+A.8)

## Re-runnable

```bash
export OPENROUTER_API_KEY=$(cat key.openrouter | tr -d '\n')
node scripts/h12-runner-parallel.mjs
node scripts/h12-eval.mjs
node scripts/h12-write-result.mjs > data/evo/experiments/h12-capability-feature-interaction/result.md
```
