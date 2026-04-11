---
name: graph-performance-analysis
description: Autonomous quantitative performance analysis using Amdahl's Law, Little's Law, and DORA metrics — identifies bottlenecks, measures throughput, cycle time, and flow efficiency
triggers:
  - graph-performance-analysis
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-performance-analysis

Autonomous quantitative performance analysis of the execution graph workflow. Applies Amdahl's Law, Little's Law, DORA metrics, and flow efficiency calculations to identify bottlenecks, measure throughput, optimize cycle time, and predict capacity. Unlike `graph-performance` (manual infrastructure audit), this skill runs autonomously and focuses on workflow execution performance.

## When to Use

- Proactively triggered at every sprint boundary to measure workflow performance
- When throughput drops below the 3-sprint rolling average by >15%
- When cycle time for any task exceeds 2x the category average
- After every 10th task completion to update running performance metrics
- The user says "performance analysis", "bottleneck analysis", "flow metrics", or "DORA metrics"
- Autonomously triggered when `forecast(mode: "velocity")` shows declining trend for 2+ consecutive sprints

## Mandatory Flow

```
collect(metrics + forecast) → compute(Little's Law + Amdahl's + DORA) → bottleneck(identify constraints) → optimize(recommendations) → write_memory
```

## Workflow

### Step 1: Collect — Raw Performance Data

Gather all quantitative performance data from the graph:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__forecast (mode: "velocity")
```

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

Extract the following raw data points:

| Metric | Source | Unit |
|--------|--------|------|
| Tasks completed per sprint | `metrics` | count |
| Average cycle time | `metrics` | hours |
| Average lead time | `metrics` | hours |
| WIP at measurement time | `metrics` | count |
| Time in each status | `metrics` | hours |
| Deployment frequency | `forecast(dora)` | per week |
| Lead time for changes | `forecast(dora)` | hours |
| Change failure rate | `forecast(dora)` | percentage |
| Mean time to recovery | `forecast(dora)` | hours |

### Step 2: Compute — Apply Performance Models

**Little's Law Analysis:**

```
L = lambda * W
```

Where: `L` = average WIP, `lambda` = throughput (tasks/day), `W` = average cycle time (days).

Derived insights:
- If `W` is increasing while `lambda` is constant, WIP is growing (overcommitment)
- If `lambda` is decreasing while `L` is constant, `W` must be increasing (friction)
- Optimal WIP = `lambda_target * W_current` (solve for L given desired throughput)

**Amdahl's Law Analysis:**

```
Speedup = 1 / ((1 - P) + P/S)
```

Where: `P` = proportion of parallelizable work, `S` = speedup factor for parallel portion.

Identify the serial fraction:
- Tasks with sequential dependencies that cannot be parallelized
- Review/approval gates that block all downstream work
- Shared resources (single graph DB, single test runner)

Calculate maximum theoretical speedup if parallel portions are optimized.

**Flow Efficiency:**

```
Flow Efficiency = Active Time / Lead Time * 100%
```

Where: `Active Time` = time in `in_progress`, `Lead Time` = `done_timestamp - created_at`.

| Flow Efficiency | Rating | Interpretation |
|----------------|--------|----------------|
| > 40% | Good | Minimal waiting, healthy flow |
| 25-40% | Acceptable | Some queue time, room to improve |
| 15-25% | Poor | Significant waiting, investigate blockers |
| < 15% | Critical | Most time spent waiting, process is broken |

### Step 3: Bottleneck — Identify Constraints (Theory of Constraints)

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Apply the Theory of Constraints five focusing steps:

1. **Identify** the constraint: Which phase/status has the most tasks queued?
2. **Exploit** the constraint: Is the bottleneck phase working at full capacity?
3. **Subordinate** everything else: Are upstream phases producing faster than the bottleneck can consume?
4. **Elevate** the constraint: What would it take to increase the bottleneck's throughput?
5. **Repeat**: After fixing, find the new bottleneck.

Bottleneck detection heuristics:

| Signal | Indicates |
|--------|-----------|
| Many `ready` tasks, few `in_progress` | Bottleneck at task pickup (capacity issue) |
| Many `in_progress`, few moving to `done` | Bottleneck at completion (complexity or testing) |
| Many `blocked`, few `ready` | Bottleneck at dependency resolution |
| Long time in `in_progress` for specific types | Type-specific bottleneck (e.g., UI tasks slower) |

### Step 4: DORA Metrics Assessment

Evaluate against DORA benchmarks:

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| Deployment frequency | On-demand (multiple/day) | 1/day - 1/week | 1/week - 1/month | < 1/month |
| Lead time for changes | < 1 hour | 1 day - 1 week | 1 week - 1 month | > 1 month |
| Change failure rate | < 5% | 5-10% | 10-15% | > 15% |
| Mean time to recovery | < 1 hour | < 1 day | 1 day - 1 week | > 1 week |

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

Classify the project into a DORA tier and identify the weakest metric for targeted improvement.

### Step 5: Optimize — Generate Recommendations

Based on the analysis, generate prioritized optimization recommendations:

For each bottleneck or underperforming metric:
1. Quantify the impact (how much throughput/cycle time would improve)
2. Estimate the effort to fix (XS/S/M/L)
3. Calculate ROI: `impact / effort`
4. Rank by ROI, apply top 3

Common optimizations:

| Problem | Solution | Expected Impact |
|---------|----------|-----------------|
| High WIP | Enforce WIP limits (max 1-2 per agent) | 20-40% cycle time reduction |
| Low flow efficiency | Reduce handoff queues, batch reviews | 15-30% lead time reduction |
| Serial bottleneck | Parallelize independent tasks, decompose | Up to Amdahl's limit |
| High change failure | Increase test coverage, add AC validation | 50%+ failure rate reduction |
| Slow recovery | Add self-healing, improve diagnostics | 60%+ MTTR reduction |

### Step 6: Record Analysis

Save the full performance analysis:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Performance Analysis — <date>"
  content: "<Little's Law results, Amdahl's analysis, DORA tier, bottlenecks, recommendations>"
  tags: ["performance", "analysis", "littles-law", "dora", "bottleneck"]
```

## Output Format

```
Phase: PERFORMANCE ANALYSIS (Autonomous)

Little's Law:
  WIP (L): <N> | Throughput (lambda): <N>/day | Cycle Time (W): <N>h
  Optimal WIP: <N> (current delta: <+/-N>)

Amdahl's Law:
  Serial fraction: <N>% | Parallel fraction: <N>%
  Max theoretical speedup: <N>x
  Current speedup: <N>x (<N>% of theoretical max)

Flow Efficiency: <N>% (<Good/Acceptable/Poor/Critical>)
  Active time: <N>h avg | Wait time: <N>h avg

DORA Metrics:
  Deployment frequency: <value> (<Elite/High/Medium/Low>)
  Lead time for changes: <value> (<Elite/High/Medium/Low>)
  Change failure rate: <value> (<Elite/High/Medium/Low>)
  Mean time to recovery: <value> (<Elite/High/Medium/Low>)
  Overall tier: <Elite/High/Medium/Low>

Bottleneck: <description> (constraint phase: <phase>)
  Queued tasks: <N> | Processing rate: <N>/day

Recommendations (by ROI):
  1. <action> — impact: <N>%, effort: <size>
  2. <action> — impact: <N>%, effort: <size>
  3. <action> — impact: <N>%, effort: <size>

Saved to memory: "Performance Analysis — <date>"
```

## Anti-Patterns

- Do NOT confuse this with `graph-performance` (infrastructure audit) — this is workflow execution analysis
- Do NOT apply Little's Law without stable-state assumption — verify WIP is relatively constant over the measurement period
- Do NOT optimize non-bottlenecks — Theory of Constraints says improving anything other than the constraint is waste
- Do NOT set WIP limits to 0 — that stops all work; minimum WIP is 1
- Do NOT compare DORA metrics across wildly different project types — context matters
- Do NOT generate recommendations without quantifying expected impact — every recommendation needs a number
- Do NOT skip recording — performance baselines are essential for trend detection
