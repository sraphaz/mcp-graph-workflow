---
name: graph-ai-token-economy-benchmark
description: Measures, tracks, and reports AI token economy with deterministic coverage and cost savings projections
triggers:
  - graph-ai-token-economy-benchmark
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-ai-token-economy-benchmark

Autonomous skill for measuring, tracking, and reporting AI token economy across the execution graph. Quantifies tokens used versus tokens avoided through deterministic paths, calculates deterministic coverage percentage, and projects cost savings over time. Compares deterministic versus AI fallback paths on latency, accuracy, and cost dimensions. Generates trending reports that surface optimization opportunities and regressions.

## When to Use

- When performing periodic (daily/weekly/sprint) token economy reviews
- When justifying the ROI of deterministic-first architecture to stakeholders
- When a new module or feature is deployed and its token impact needs baselining
- When the token budget for a sprint or project phase needs forecasting
- When investigating unexpected spikes in AI token consumption
- When comparing two implementation approaches (deterministic vs. AI-heavy) for cost-effectiveness

## Mandatory Flow

```
metrics(token_snapshot) → analyze(deterministic_coverage) → [compute cost model] → [generate trend report] → [project savings] → write_memory
```

## Workflow

### Step 1: Capture Token Snapshot

Collect the current token usage data across all graph operations. This is the raw data that feeds all subsequent analysis.

- `Tool: mcp__mcp-graph__metrics` — retrieve token usage metrics for the current period
- Collect per-operation data: operation type, tokens consumed (input + output), deterministic flag, timestamp
- Segment by source: MCP tool calls, RAG queries, context assembly, AI fallbacks
- Build the token ledger: a complete record of every token-consuming operation

### Step 2: Compute Deterministic Coverage

Calculate the percentage of operations handled by deterministic layers versus AI fallback.

- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, assess deterministic vs. fallback distribution
- Deterministic Coverage = `(ops_handled_deterministically / total_ops) * 100`
- Break down by deterministic layer to identify which layers carry the most load

| Layer | Operations | Tokens Saved | Coverage Contribution |
|-------|-----------|-------------|----------------------|
| 0 - Pure Rules / SQL | {n} | {tokens} | {%} |
| 1 - Cache / Memoization | {n} | {tokens} | {%} |
| 2 - Heuristics / FSM | {n} | {tokens} | {%} |
| 3 - Property-Based / Snapshot | {n} | {tokens} | {%} |
| 4 - Meta-Rule Learning | {n} rules | {tokens} (projected) | {%} |
| AI Fallback | {n} | — (consumed) | — |

### Step 3: Build Cost Model

Map token consumption to actual cost using the provider pricing model. Support multiple models and pricing tiers.

- Define cost per token by model: input tokens, output tokens, cached tokens
- Calculate actual cost: `sum(input_tokens * input_price + output_tokens * output_price)` for AI fallbacks
- Calculate avoided cost: estimate tokens that would have been consumed if deterministic paths used AI instead
- Avoided cost formula: `sum(estimated_ai_tokens_per_op * cost_per_token)` for deterministic operations
- Net savings = avoided cost - implementation cost of deterministic infrastructure
- `Tool: mcp__mcp-graph__metrics` — record cost model outputs

### Step 4: Compare Deterministic vs. Fallback Paths

For operations that exist in both deterministic and AI fallback form, perform a head-to-head comparison.

| Dimension | Deterministic Path | AI Fallback Path | Winner |
|-----------|-------------------|-----------------|--------|
| Latency (p50) | {ms} | {ms} | {lower} |
| Latency (p99) | {ms} | {ms} | {lower} |
| Accuracy | {%} (validated by Layer 3) | {%} (spot-checked) | {higher} |
| Token Cost | 0 | {tokens} | deterministic |
| Reliability | {uptime %} | {uptime %} (depends on API) | {higher} |
| Cache Hit Rate | {%} | N/A | deterministic |

- Identify operations where AI fallback outperforms deterministic (accuracy edge cases)
- Flag these as candidates for improved deterministic rules (feed into meta-rule learning)
- `Tool: mcp__mcp-graph__analyze` — mode: `validate_ready`, cross-validate comparison results

### Step 5: Generate Trend Report

Compare the current period against historical data to identify trends, regressions, and optimization opportunities.

- Pull historical token snapshots from knowledge store
- `Tool: mcp__mcp-graph__write_memory` — retrieve previous benchmark memories
- Calculate period-over-period deltas: token consumption change, coverage change, cost change
- Identify regression signals: increasing AI fallback rate, decreasing cache hit rate, new high-token operations
- Identify optimization signals: frequently repeated AI fallbacks (candidates for meta-rules), unused cache entries (candidates for eviction)

### Step 6: Project Future Savings

Use the trend data to forecast token economy over the next 1, 3, and 6 months assuming current trajectory.

- `Tool: mcp__mcp-graph__metrics` — retrieve velocity and throughput data for projection basis
- Linear projection: extrapolate current deterministic coverage growth rate
- Optimistic projection: assume meta-rule learning accelerates coverage by 5% per month
- Conservative projection: assume coverage plateaus at current rate
- Calculate projected cost savings under each scenario

| Projection | 1 Month | 3 Months | 6 Months |
|-----------|---------|----------|----------|
| Linear | ${savings} ({coverage}%) | ${savings} ({coverage}%) | ${savings} ({coverage}%) |
| Optimistic | ${savings} ({coverage}%) | ${savings} ({coverage}%) | ${savings} ({coverage}%) |
| Conservative | ${savings} ({coverage}%) | ${savings} ({coverage}%) | ${savings} ({coverage}%) |

### Step 7: Identify Top Optimization Targets

Rank operations by token waste (high AI fallback frequency with deterministic alternative potential).

- Sort AI fallback operations by: frequency * tokens_per_call = total token waste
- For each top-10 target: estimate effort to create deterministic alternative, calculate ROI
- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, check if optimization targets align with planned work
- Create recommended action items with priority ranking

### Step 8: Persist Benchmark Results

Save the complete benchmark for historical trending and future comparisons.

- `Tool: mcp__mcp-graph__write_memory` — save: token ledger summary, coverage metrics, cost model, trend analysis, projections, optimization targets
- Tag with `token-economy`, `benchmark`, `deterministic-ai`, period identifier (e.g., `2026-Q2-W15`)
- Include machine-readable metrics for automated trend aggregation

## Output Format

```
## AI Token Economy Benchmark

### Period: {start_date} to {end_date}

### Executive Summary
- Total operations: {N}
- Deterministic coverage: {%} ({delta from last period})
- Tokens consumed (AI): {N} ({delta})
- Tokens saved (deterministic): {N} ({delta})
- Net cost savings: ${amount} ({delta})
- AI Usage Reduction Score: {score}%

### Token Ledger
| Category | Operations | Input Tokens | Output Tokens | Total Tokens | Cost |
|----------|-----------|-------------|--------------|-------------|------|
| Deterministic (L0-L3) | {n} | 0 | 0 | 0 | $0 |
| AI Fallback | {n} | {tokens} | {tokens} | {tokens} | ${cost} |
| Tokens Avoided | — | {tokens} | {tokens} | {tokens} | ${saved} |

### Deterministic Layer Breakdown
| Layer | Hits | Coverage % | Tokens Saved | Avg Latency |
|-------|------|-----------|-------------|-------------|
| 0 - Pure Rules / SQL | {n} | {%} | {tokens} | {ms} |
| 1 - Cache / Memoization | {n} | {%} | {tokens} | {ms} |
| 2 - Heuristics / FSM | {n} | {%} | {tokens} | {ms} |
| 3 - Property-Based | {n} | {%} | {tokens} | {ms} |
| 4 - Meta-Rule Learning | {n} rules | — | {tokens} (projected) | — |

### Trend (Last 5 Periods)
| Period | Coverage % | AI Tokens | Cost | Score |
|--------|-----------|-----------|------|-------|
| {p1}   | {%}       | {tokens}  | ${c} | {s}   |
| ...    | ...       | ...       | ...  | ...   |

### Savings Projection
| Scenario | 1 Month | 3 Months | 6 Months |
|----------|---------|----------|----------|
| Linear | ${s} | ${s} | ${s} |
| Optimistic | ${s} | ${s} | ${s} |
| Conservative | ${s} | ${s} | ${s} |

### Top Optimization Targets
| Rank | Operation | Frequency | Tokens/Call | Total Waste | Est. Effort | ROI |
|------|-----------|-----------|-------------|------------|-------------|-----|
| 1    | {op}      | {n}/period | {tokens}   | {tokens}   | {hours}h    | {x}x |
| ...  | ...       | ...        | ...         | ...         | ...          | ... |

### Knowledge Persisted
- Memory ID: {id}
- Tags: {tags}
```

## Anti-Patterns

- Do NOT benchmark token economy without including deterministic operations; measuring only AI usage misses the full picture
- Do NOT project savings using only optimistic assumptions; always include conservative and linear scenarios
- Do NOT ignore small-token high-frequency operations; they often account for more total waste than large-token rare operations
- Do NOT compare deterministic vs. AI paths without controlling for accuracy; a cheaper path that gives wrong answers has negative ROI
- Do NOT treat the benchmark as a one-time exercise; run it at regular intervals to catch regressions early
- Do NOT store only summary metrics; persist the full token ledger for drill-down analysis in future cycles
- Do NOT skip the optimization target ranking; actionable recommendations are the primary value of the benchmark
