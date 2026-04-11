---
name: graph-nirvana-forge
description: Plans the eternal Nirvana roadmap for the open core using MAPE-K autonomous loop — scans graph for incomplete areas, generates improvement tasks, prioritizes by impact
triggers:
  - graph-nirvana-forge
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nirvana-forge

Plans the eternal Nirvana roadmap for the mcp-graph open core. Autonomously scans the execution graph for incomplete areas, stale tasks, quality gaps, and architectural debt, then generates prioritized improvement tasks using the MAPE-K feedback loop (Monitor, Analyze, Plan, Execute, Knowledge).

## When to Use

- Proactively triggered every sprint boundary to generate the next improvement cycle
- When the graph has >20% tasks in `blocked` or `failed` status
- After a HANDOFF phase completes — to plan the next evolutionary cycle
- When `metrics` show declining velocity or increasing cycle time over 3+ sprints
- The user says "plan roadmap", "nirvana forge", "what should we improve next"
- Autonomously triggered when `analyze(mode: "progress")` shows stagnation (throughput < 50% of peak)

## Mandatory Flow

```
monitor(metrics + graph scan) → analyze(gaps + debt + impact) → plan(prioritized tasks) → execute(create nodes + edges) → knowledge(write_memory) → verify(analyze) → write_memory
```

## Workflow

### Step 1: Monitor — Collect Graph State

Gather comprehensive metrics on the current graph state:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Collect and record:

| Metric | Source | Purpose |
|--------|--------|---------|
| Total nodes by status | `metrics` | Identify completion ratio |
| Blocked/failed tasks | `metrics` | Identify stuck work |
| Average cycle time | `metrics` | Measure execution speed |
| Throughput (tasks/day) | `metrics` | Measure delivery rate |
| Knowledge coverage | `knowledge_stats` | Identify knowledge gaps |
| Sprint burndown | `analyze(progress)` | Detect stagnation trends |

```
Tool: mcp__mcp-graph__knowledge_stats
```

### Step 2: Analyze — Identify Gaps and Debt

Analyze the collected data to identify improvement areas:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Classification of gaps:

| Gap Type | Detection Method | Priority Weight |
|----------|-----------------|-----------------|
| Incomplete epics | Epics with <50% child tasks done | 0.9 |
| Orphan tasks | Tasks with no parent epic or edges | 0.7 |
| Stale blocked tasks | Blocked >5 days with no status change | 0.95 |
| Missing acceptance criteria | Tasks without AC (DoD check #1) | 0.8 |
| Knowledge gaps | Areas with <3 knowledge entries | 0.6 |
| Architectural debt | High-complexity modules without tests | 0.85 |
| Dependency bottlenecks | Nodes with >5 downstream dependents | 0.9 |

Score each gap: `impact = priority_weight * affected_node_count * recency_factor`.

### Step 3: Plan — Generate Prioritized Improvement Tasks

Using the gap analysis, generate improvement tasks ranked by impact score:

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

For each identified gap (top 10 by impact):

1. Draft a task title and description with clear acceptance criteria
2. Assign estimated size (XS/S/M/L) based on gap complexity
3. Determine dependencies from existing graph structure
4. Tag with category: `debt-reduction`, `quality-improvement`, `knowledge-gap`, `architecture`, `velocity-boost`

### Step 4: Execute — Create Nodes and Edges in Graph

Create an epic for the improvement cycle:

```
Tool: mcp__mcp-graph__node (action: "add", type: "epic", title: "Nirvana Forge — Cycle <N>", description: "<summary of top gaps>")
```

For each planned improvement task:

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "<task title>", description: "<task description with AC>")
```

```
Tool: mcp__mcp-graph__edge (from: "<epic_id>", to: "<task_id>", type: "parent_of")
```

Link dependencies between new tasks and existing graph nodes:

```
Tool: mcp__mcp-graph__edge (from: "<dependency_id>", to: "<task_id>", type: "depends_on")
```

### Step 5: Knowledge — Record Decisions and Patterns

Save the roadmap rationale and discovered patterns:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Nirvana Forge — Cycle <N> Roadmap"
  content: "<gap analysis summary, prioritization rationale, created tasks, expected impact>"
  tags: ["nirvana", "roadmap", "forge", "mape-k"]
```

### Step 6: Verify — Validate the New Roadmap

Run integrity checks on the updated graph:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Verify:
- No dependency cycles introduced
- All new tasks have acceptance criteria
- Epic structure is valid (parent-child edges correct)
- Estimated total effort aligns with team velocity (from `forecast`)

If verification fails, iterate: fix edges, update descriptions, re-run analysis.

## Output Format

```
Phase: NIRVANA FORGE — Cycle <N>
MAPE-K Loop: Monitor -> Analyze -> Plan -> Execute -> Knowledge

Monitor:
  Total nodes: <N> (done: <N>, in_progress: <N>, blocked: <N>, failed: <N>)
  Velocity: <N> tasks/day (trend: <up/down/stable>)
  Knowledge coverage: <N>%

Analyze:
  Gaps found: <N> (critical: <N>, moderate: <N>, low: <N>)
  Top gap: <description> (impact score: <N>)
  Debt areas: <N> modules flagged

Plan:
  Improvement tasks generated: <N>
  Categories: debt-reduction (<N>), quality (<N>), knowledge (<N>), architecture (<N>)
  Estimated effort: <N> story points

Execute:
  Epic created: <epic_id> — "Nirvana Forge — Cycle <N>"
  Tasks created: <N> with <N> dependency edges
  
Knowledge:
  Memory saved: "Nirvana Forge — Cycle <N> Roadmap"

Verify: <passed/failed — details if failed>
```

## Anti-Patterns

- Do NOT generate improvement tasks without first collecting metrics — data-driven decisions only
- Do NOT create tasks without acceptance criteria — every task must be verifiable
- Do NOT ignore dependency cycles — always validate graph integrity after adding nodes/edges
- Do NOT prioritize by gut feeling — use the impact scoring formula consistently
- Do NOT create more than 15 tasks per cycle — keep WIP manageable per Little's Law
- Do NOT skip the Knowledge step — roadmap rationale must be persisted for future cycles
- Do NOT forge tasks that duplicate existing graph nodes — always search before creating
