---
name: graph-llm-orchestrator
description: Dynamic multi-LLM routing by task complexity, cost budget, and quality requirements — optimizes model selection across the workflow
triggers:
  - graph-llm-orchestrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-llm-orchestrator

Dynamically routes prompts to the optimal LLM based on task complexity, cost budget, and quality requirements. Maintains a routing policy table that evolves from execution feedback, ensuring every graph task uses the most cost-effective model that meets its quality threshold.

## When to Use

- Before starting a new sprint or batch of tasks — to pre-assign model tiers
- When cost metrics exceed budget thresholds detected via `metrics`
- When task quality scores drop below acceptable levels after implementation
- Proactively triggered when `analyze(progress)` reveals cost/quality imbalance
- When onboarding a new model or deprecating an old one from the routing pool
- Autonomously after every 10 completed tasks to recalibrate routing weights

## Mandatory Flow

```
analyze(progress) → classify_tasks → score_models → build_routing_table → apply_routes → monitor_outcomes → write_memory
```

## Workflow

### Step 1: Assess Current State

Gather cost and quality baselines from the graph:
```
Tool: mcp__mcp-graph__metrics
```

Review recent execution patterns and model usage history:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Collect key metrics:
- Average cost per task (by xpSize: XS, S, M, L, XL)
- Quality scores from DoD checks (Grade A/B/C/D distribution)
- Cycle time per model tier used in previous tasks

### Step 2: Classify Task Complexity

For each pending task in the graph, determine complexity tier:
```
Tool: mcp__mcp-graph__search (query: "status:ready OR status:pending")
```

Apply classification heuristic:

| Complexity | Criteria | Recommended Tier |
|------------|----------|-----------------|
| Trivial | xpSize XS, no dependencies, boilerplate | Fast/cheap model |
| Standard | xpSize S-M, 1-2 dependencies, clear AC | Mid-tier model |
| Complex | xpSize L-XL, 3+ dependencies, ambiguous AC | Premium model |
| Critical | Architectural decisions, security, data integrity | Premium model + review |

### Step 3: Score Available Models

Build a model scoring matrix based on historical performance:
```
Tool: mcp__mcp-graph__rag_context (query: "model performance routing history")
```

Score each model across dimensions:
- **Quality**: Average DoD grade when model was used (A=4, B=3, C=2, D=1)
- **Speed**: Average cycle time for task completion
- **Cost**: Token cost per task completion
- **Reliability**: Success rate (tasks completed without rework)

### Step 4: Build Routing Table

Construct the routing policy as a decision matrix:

| Task Tier | Primary Model | Fallback Model | Max Cost | Min Quality |
|-----------|--------------|----------------|----------|-------------|
| Trivial | Fast/cheap | Mid-tier | $0.01 | Grade C |
| Standard | Mid-tier | Premium | $0.10 | Grade B |
| Complex | Premium | Premium+review | $1.00 | Grade A |
| Critical | Premium | Premium+human | $5.00 | Grade A |

### Step 5: Apply Routes and Monitor

For the current sprint, tag each task with its assigned model tier:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Track routing decisions for feedback loop:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "decision"
  content: "LLM routing policy updated: [routing_table_summary]"
  tags: ["llm-routing", "cost-optimization", "model-selection"]
```

### Step 6: Forecast Cost Impact

Project cost savings from optimized routing:
```
Tool: mcp__mcp-graph__forecast
```

Compare projected costs against budget:
- If projected cost exceeds budget by >20%, shift more tasks to cheaper tiers
- If quality scores trend below targets, shift critical tasks to premium tiers

### Step 7: Self-Healing Loop

After each batch of 5-10 completed tasks, re-evaluate routing effectiveness:

1. Pull actual cost and quality data from completed tasks
2. Compare against routing predictions
3. Adjust routing weights where predictions diverged >15% from actuals
4. Log adjustments to memory for future calibration

```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Routing calibration: [adjustments_summary]"
  tags: ["llm-routing", "calibration", "self-healing"]
```

## Output Format

```
LLM Orchestrator Report
=======================
Sprint: <sprint_id>
Tasks Routed: <N>

Routing Distribution:
  Trivial (fast model): <N> tasks (<cost>)
  Standard (mid-tier):  <N> tasks (<cost>)
  Complex (premium):    <N> tasks (<cost>)
  Critical (premium+):  <N> tasks (<cost>)

Projected Cost: $<total>
Budget Remaining: $<remaining>
Quality Target: Grade <X> avg
Routing Accuracy: <N>% (vs last calibration)

Adjustments Made: <N> route changes
Next Calibration: after <N> more tasks
```

## Anti-Patterns

- Do NOT route all tasks to premium models "just to be safe" — this defeats cost optimization
- Do NOT change routing mid-task — apply new routes only to pending/ready tasks
- Do NOT ignore quality degradation signals — if Grade C tasks increase, escalate model tier immediately
- Do NOT hardcode routing rules — the table must evolve from execution feedback
- Do NOT skip the self-healing calibration loop — stale routing policies waste budget
- Do NOT route security or data-integrity tasks to cheap models regardless of xpSize
- Do NOT forget to persist routing decisions via `write_memory` — they inform future calibrations
