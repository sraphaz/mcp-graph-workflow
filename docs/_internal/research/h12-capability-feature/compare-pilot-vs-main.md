# H12 pilot vs main comparison

Pilot designHash: `4e41e13d43d4` (commit baca96e+85d6e8e+a8c724a)
Main designHash:  `2abd76f82ba5` (commit a11f3cb)

Pilot N=3, Main N=5. Main has T1 max_tokens=16384 (was 8192).

| Cell (model.condition) | Pilot mean (N=3) | Main mean (N=5) | Δ (main − pilot) |
|---|---|---|---|
| decomp.deepseek-r1 | 39% (3/3) | 37% (5/5) | -2pts |
| decomp.haiku-4.5 | 50% (3/3) | 67% (5/5) | +17pts |
| decomp.llama-70b | 0% (3/3) | 0% (5/5) | +0pts |
| decomp.mistral-7b | 0% (3/3) | 0% (5/5) | +0pts |
| decomp.qwen-thinking | 33% (3/3) | 17% (5/5) | -17pts |
| mono.deepseek-r1 | 50% (2/3) | 48% (5/5) | -2pts |
| mono.haiku-4.5 | 0% (3/3) | 0% (5/5) | +0pts |
| mono.llama-70b | 40% (3/3) | 40% (3/5) | +0pts |
| mono.mistral-7b | 0% (3/3) | 80% (5/5) | +80pts |
| mono.qwen-thinking | 20% (2/3) | 64% (5/5) | +44pts |

## By tier × condition

| Tier | Condition | Pilot mean | Main mean | Δ |
|---|---|---|---|---|
| T1 | mono | 35% | 56% | +21pts |
| T1 | decomp | 36% | 27% | -9pts |
| T2 | mono | 40% | 40% | +0pts |
| T2 | decomp | 0% | 0% | +0pts |
| T3 | mono | 0% | 40% | +40pts |
| T3 | decomp | 25% | 33% | +8pts |

## Replication signal

- T3 drop pilot: -25%; T3 drop main: 7%
- Direction DIVERGES
- T1 mono pilot: 35% → main: 56% (budget bump effect)
- T1 decomp pilot: 36% → main: 27%