---
name: graph-proactive-monitoring
description: Proactive monitoring and problem prevention — continuously monitors graph health, detects degradation trends, triggers preventive actions before problems occur
triggers:
  - graph-proactive-monitoring
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-proactive-monitoring

Proactive monitoring and problem prevention for the execution graph. Continuously monitors graph health metrics, detects degradation trends before they become failures, and triggers preventive actions. Operates on the ProactiveMonitoring pattern (predict, prevent, verify) to maintain graph reliability.

## When to Use

- Proactively triggered at the start of every IMPLEMENT phase session
- When velocity drops >20% compared to the rolling 3-sprint average
- When `knowledge_stats` shows knowledge staleness (>30% entries older than 7 days)
- Before any phase transition — to ensure the graph is healthy for the next phase
- The user says "check health", "proactive monitoring", "prevent problems", or "graph health"
- Autonomously triggered every 10 completed tasks to check for emerging trends

## Mandatory Flow

```
collect(metrics + knowledge_stats) → predict(trend analysis + anomaly detection) → prevent(preemptive actions) → verify(health check) → write_memory
```

## Workflow

### Step 1: Collect — Gather Health Telemetry

Collect current graph health metrics across all dimensions:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__knowledge_stats
```

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Build the health telemetry snapshot:

| Dimension | Metrics Collected | Healthy Threshold |
|-----------|------------------|-------------------|
| Velocity | tasks/day, throughput trend | >80% of 3-sprint avg |
| Flow | WIP count, cycle time, lead time | WIP <= 3, cycle time stable |
| Quality | blocked ratio, failed ratio | blocked < 10%, failed < 5% |
| Knowledge | coverage %, staleness %, gap count | coverage > 70%, staleness < 30% |
| Dependencies | orphan count, cycle count, bottleneck nodes | 0 cycles, 0 orphans |
| Burndown | remaining vs. planned, sprint progress | on track (within 15% of ideal) |

### Step 2: Predict — Trend Analysis and Anomaly Detection

Analyze collected metrics against historical baselines to detect degradation:

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

```
Tool: mcp__mcp-graph__forecast (mode: "velocity")
```

Prediction rules:

| Signal | Condition | Risk Level | Prediction |
|--------|-----------|------------|------------|
| Velocity drop | Current < 80% of rolling avg | Warning | Sprint will miss targets in 2-3 days |
| WIP explosion | WIP > 3 concurrent tasks | Warning | Cycle time will increase per Little's Law |
| Blocked accumulation | >3 new blocked tasks in 24h | Critical | Dependency bottleneck forming |
| Knowledge staleness | >40% entries stale | Warning | RAG quality degrading, wrong context being served |
| Cycle time increase | >30% increase over 3 sprints | Warning | Process friction increasing |
| Failed task spike | >2 failures in 24h | Critical | Systemic issue emerging |
| Burndown deviation | >25% behind ideal line | Critical | Sprint commitments at risk |

Compute a composite health score: `health = (velocity_score * 0.25) + (flow_score * 0.25) + (quality_score * 0.2) + (knowledge_score * 0.15) + (dependency_score * 0.15)`.

### Step 3: Prevent — Take Preemptive Actions

For each predicted risk, apply the corresponding preventive action:

**Velocity drop prevention:**
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```
Identify the task causing slowdown. Check if it should be decomposed into smaller tasks. If oversized:
```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Decomposed subtask from <oversized_task>")
```

**WIP explosion prevention:**
Check which tasks are `in_progress` simultaneously. Flag tasks that should be paused:
```
Tool: mcp__mcp-graph__search (query: "status:in_progress")
```
Recommend completing highest-priority in_progress task before starting new ones.

**Blocked accumulation prevention:**
```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```
Identify the common blocker. If a single task blocks >3 others, escalate its priority.

**Knowledge staleness prevention:**
```
Tool: mcp__mcp-graph__knowledge_stats
```
Trigger re-indexing for stale areas:
```
Tool: mcp__mcp-graph__reindex_knowledge
```

**Burndown deviation prevention:**
```
Tool: mcp__mcp-graph__forecast (mode: "velocity")
```
Calculate remaining work vs. available capacity. Recommend scope reduction if sprint cannot be completed.

### Step 4: Verify — Confirm Preventive Actions

After applying preventive actions, verify the graph is trending healthier:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Compare post-action metrics against pre-action baseline:
- Health score should be stable or improving
- No new issues introduced by preventive actions
- WIP should be <= previous WIP
- Blocked count should not have increased

If health score decreased after prevention, roll back the action and flag for human review.

### Step 5: Record Monitoring Results

Save the monitoring snapshot and any actions taken:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Proactive Monitoring — <date>"
  content: "<health score, predictions, preventive actions taken, verification results>"
  tags: ["monitoring", "proactive", "health", "prevention"]
```

Record trend data for future prediction accuracy:
- Was the prediction correct? (verify in next monitoring cycle)
- Did the preventive action improve the metric?
- Update prediction thresholds if false positives are detected

## Output Format

```
Phase: PROACTIVE MONITORING
Loop: Collect -> Predict -> Prevent -> Verify

Health Score: <N>/100 (trend: <up/down/stable>)

Telemetry:
  Velocity: <N> tasks/day (<N>% of rolling avg)
  WIP: <N> tasks in_progress
  Cycle time: <N>h avg (trend: <up/down/stable>)
  Blocked ratio: <N>%
  Knowledge coverage: <N>% (staleness: <N>%)
  Burndown: <on track / N% behind>

Predictions:
  Risks detected: <N> (critical: <N>, warning: <N>)
  Top risk: <description> (confidence: <N>%)

Prevention:
  Actions taken: <N>
  Tasks decomposed: <N>
  Knowledge re-indexed: <yes/no>
  WIP reduced: <yes/no>

Verify:
  Post-action health: <N>/100 (delta: <+/-N>)
  New issues: <N>

Saved to memory: "Proactive Monitoring — <date>"
```

## Anti-Patterns

- Do NOT skip metric collection before making predictions — trends require data
- Do NOT apply preventive actions based on a single data point — require 2+ signals confirming a trend
- Do NOT reduce scope without consulting the user — only recommend, never auto-remove tasks
- Do NOT re-index knowledge during active IMPLEMENT work — schedule for session boundaries
- Do NOT ignore false positives — tune prediction thresholds when predictions are wrong
- Do NOT monitor without recording — every monitoring cycle must write_memory for trend analysis
- Do NOT treat monitoring as a one-time event — it must be continuous and recurring
