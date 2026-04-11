---
name: graph-adaptive-planning
description: Dynamic adaptive planning from real-time performance feedback — adjusts task plans based on actual velocity, blockers, and resource availability
triggers:
  - graph-adaptive-planning
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-adaptive-planning

Dynamically adjusts task plans and sprint scope based on real-time performance feedback. Continuously monitors actual velocity against forecasts, detects emerging blockers before they become critical, and re-balances sprint commitments to maintain sustainable throughput. Replaces static planning with a living plan that adapts to reality.

## When to Use

- At sprint midpoint to evaluate progress against commitment
- When actual velocity deviates >20% from forecast velocity
- When a blocker is detected that affects 2+ tasks in the current sprint
- Proactively after every 3 completed tasks to check plan alignment
- When a high-priority task is added mid-sprint that was not originally planned
- Autonomously when `forecast` shows sprint completion probability drops below 70%

## Mandatory Flow

```
forecast → metrics → analyze(progress) → detect_deviations → rebalance_plan → update_sprint → write_memory
```

## Workflow

### Step 1: Gather Real-Time Performance Data

Pull current sprint metrics:
```
Tool: mcp__mcp-graph__metrics
```

Generate velocity forecast:
```
Tool: mcp__mcp-graph__forecast
```

Analyze current progress against plan:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Key performance indicators to collect:

| KPI | Planned | Actual | Delta |
|-----|---------|--------|-------|
| Tasks completed | N | N | +/- N |
| Velocity (tasks/day) | N | N | +/- N% |
| Avg cycle time | Nh | Nh | +/- Nh |
| Blocked tasks | 0 | N | +N |
| Scope changes | 0 | N | +N |
| Sprint burndown | linear | actual_shape | deviation |

### Step 2: Detect Deviations

Identify significant deviations that require plan adjustment:

| Deviation Type | Threshold | Severity | Action |
|---------------|-----------|----------|--------|
| Velocity drop | >20% below plan | High | Re-scope sprint |
| Velocity surge | >30% above plan | Low | Pull forward next sprint |
| Blocker cascade | 2+ tasks blocked | High | Resolve or descope |
| Scope creep | >2 tasks added mid-sprint | Medium | Evaluate and negotiate |
| Cycle time spike | >2x average | Medium | Investigate root cause |
| Quality drop | DoD grade avg <B | High | Slow down, focus quality |

### Step 3: Root Cause Analysis

For each significant deviation, diagnose the root cause:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Common root causes and their indicators:

| Root Cause | Indicators | Typical Fix |
|------------|-----------|-------------|
| Underestimation | All tasks taking >1.5x estimate | Apply calibration factor |
| Missing dependency | Unexpected blockers mid-task | Add edges, re-sequence |
| Technical debt | Simple tasks with high cycle time | Allocate refactoring sprint |
| Context switching | Multiple tasks in_progress | Enforce WIP=1 |
| Unclear AC | Repeated rework on same task | Rewrite AC before continuing |
| External dependency | Waiting on API/service/decision | Descope or add buffer |

### Step 4: Rebalance the Plan

Based on deviation analysis, apply the appropriate rebalancing strategy:

**Strategy A — Scope Reduction (velocity too low):**
1. Identify lowest-priority tasks in the sprint
2. Move them to the next sprint backlog
3. Keep only tasks that are in_progress or have in_progress dependents
4. Recalculate sprint commitment

**Strategy B — Scope Expansion (velocity too high):**
1. Pull highest-priority tasks from the next sprint
2. Ensure pulled tasks have all dependencies satisfied
3. Recalculate sprint commitment

**Strategy C — Re-sequencing (blocker detected):**
1. Identify all tasks affected by the blocker
2. Find alternative tasks with no dependency on the blocker
3. Swap blocked tasks with unblocked alternatives
4. Update task priority to reflect new sequence

**Strategy D — Quality Recovery (grade degradation):**
1. Reduce sprint velocity target by 25%
2. Add explicit review steps to remaining tasks
3. Require Grade A on all remaining tasks (no exceptions)
4. Consider adding a dedicated quality improvement task

### Step 5: Update Sprint Plan

Apply the rebalanced plan to the graph:
```
Tool: mcp__mcp-graph__plan_sprint
```

Verify the updated plan is consistent:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Generate updated forecast:
```
Tool: mcp__mcp-graph__forecast
```

Confirm sprint completion probability is now >80%.

### Step 6: Communicate Changes

Document what changed and why:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "decision"
  content: "Sprint rebalance [date]: Deviation=<type>, Root cause=<cause>. Strategy=<A/B/C/D>. Changes: <tasks_moved/resequenced/added>. New forecast: <completion_probability>%."
  tags: ["adaptive-planning", "sprint-rebalance", "velocity"]
```

### Step 7: Velocity Calibration

Update estimation calibration factors based on actual performance:

| Task Size | Estimated Hours | Actual Hours (avg) | Calibration Factor |
|-----------|----------------|-------------------|-------------------|
| XS | 0.5h | h | x |
| S | 1h | h | x |
| M | 2h | h | x |
| L | 4h | h | x |
| XL | 8h | h | x |

Persist calibration for future sprint planning:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "estimates"
  content: "Velocity calibration [sprint_id]: XS=<factor>x, S=<factor>x, M=<factor>x, L=<factor>x, XL=<factor>x. Based on <N> completed tasks."
  tags: ["adaptive-planning", "velocity-calibration", "estimation"]
```

### Step 8: Predictive Monitoring

Set up continuous monitoring for the remainder of the sprint:

- Re-evaluate forecast every 3 completed tasks
- If completion probability drops below 70%, trigger immediate rebalance
- If a new blocker emerges, escalate within 1 task cycle
- Track daily velocity trend to detect slowdowns early

```
Tool: mcp__mcp-graph__forecast
```

### Step 9: Self-Healing Loop

Improve adaptive planning itself over time:

1. Track prediction accuracy: How often did forecasts match reality?
2. Track rebalance effectiveness: Did rebalances improve outcomes?
3. Track calibration convergence: Are estimation factors stabilizing?
4. If calibration factors diverge sprint-over-sprint, the estimation model needs restructuring

```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Adaptive planning meta-analysis [sprint_id]: Forecast accuracy=<N>%, Rebalances=<N>, Effectiveness=<N>%. Calibration trend=<converging/diverging>."
  tags: ["adaptive-planning", "meta-analysis", "forecast-accuracy"]
```

## Output Format

```
Adaptive Planning Report
========================
Sprint: <sprint_id>
Day: <current>/<total>

Performance vs Plan:
  Velocity:    <planned> → <actual> (<delta>%)
  Completed:   <N>/<total> tasks
  Blocked:     <N> tasks
  Scope Changes: <N> tasks added/removed

Deviations Detected: <N>
  - <deviation_type>: <description> (severity: <high/medium/low>)

Rebalance Applied: <strategy_A/B/C/D>
  Tasks Removed: <N> (moved to next sprint)
  Tasks Added:   <N> (pulled from backlog)
  Tasks Resequenced: <N>

Updated Forecast:
  Completion Probability: <N>%
  Estimated Remaining: <N> tasks, <N> hours
  Sprint End Date: <date> (on track / at risk / delayed)

Calibration Factors Updated: <yes/no>
Next Check: after <N> tasks or <date>
```

## Anti-Patterns

- Do NOT rebalance more than once per day — frequent changes create instability and confusion
- Do NOT descope tasks that are already in_progress — complete or explicitly block them
- Do NOT ignore velocity trends in favor of optimistic forecasts — plan from reality, not hope
- Do NOT add tasks mid-sprint without removing equivalent effort — scope creep is the primary sprint killer
- Do NOT skip root cause analysis — rebalancing symptoms without fixing causes leads to recurring deviations
- Do NOT apply calibration factors from a different project type — calibration is project-specific
- Do NOT treat the forecast as a commitment — it is a probability distribution, communicate uncertainty ranges
