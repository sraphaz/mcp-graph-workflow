---
name: graph-reasoning-engine
description: Advanced reasoning engine — selects optimal strategy (ReAct, Chain-of-Thought, Tree-of-Thoughts, Graph-of-Thoughts) per task type
triggers:
  - graph-reasoning-engine
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-reasoning-engine

Selects and executes the optimal reasoning strategy for each task based on its structure, complexity, and domain. Supports ReAct, Chain-of-Thought (CoT), Tree-of-Thoughts (ToT), and Graph-of-Thoughts (GoT) paradigms, with automatic fallback and strategy blending when a single approach is insufficient.

## When to Use

- Before tackling any task rated Complex or Critical (xpSize L/XL)
- When a task involves multi-step reasoning with uncertain intermediate results
- When standard linear reasoning produces low-confidence outputs
- Proactively when `analyze` detects tasks with high dependency count or ambiguous AC
- When the agent is stuck in a reasoning loop or producing contradictory outputs
- Autonomously when task complexity score exceeds the threshold for simple CoT

## Mandatory Flow

```
analyze(task_complexity) → select_strategy → execute_reasoning → evaluate_result → fallback_if_needed → write_memory
```

## Workflow

### Step 1: Analyze Task Structure

Load full task context to understand reasoning requirements:
```
Tool: mcp__mcp-graph__context (nodeId: <node_id>)
```

Enrich with deep knowledge:
```
Tool: mcp__mcp-graph__rag_context (query: "<task_description> architecture patterns")
```

Classify the task along reasoning dimensions:

| Dimension | Low | Medium | High |
|-----------|-----|--------|------|
| Branching factor | Single path | 2-3 alternatives | 4+ alternatives |
| Depth | 1-2 steps | 3-5 steps | 6+ steps |
| Uncertainty | Clear inputs/outputs | Some ambiguity | High ambiguity |
| Reversibility | Easily undone | Partially reversible | Irreversible |
| Interdependence | Isolated | Moderate coupling | Tight coupling |

### Step 2: Select Reasoning Strategy

Based on the task classification, select the optimal strategy:

| Strategy | Best For | When to Use |
|----------|----------|-------------|
| **Chain-of-Thought (CoT)** | Linear, sequential problems | Low branching, moderate depth, clear inputs |
| **ReAct** | Tasks requiring external validation | Needs tool calls, API checks, or file system reads between steps |
| **Tree-of-Thoughts (ToT)** | Exploratory problems with multiple valid paths | High branching, need to evaluate alternatives |
| **Graph-of-Thoughts (GoT)** | Complex problems with interdependent sub-problems | High interdependence, cycles, constraint satisfaction |
| **Hybrid CoT+ReAct** | Implementation tasks with verification needs | Standard coding tasks that need test feedback |
| **Hybrid ToT+GoT** | Architectural decisions with cascading effects | Design decisions affecting multiple modules |

### Step 3: Execute Chain-of-Thought (CoT)

For linear reasoning tasks:

1. **Decompose**: Break the problem into sequential steps
2. **Reason**: For each step, explicitly state the reasoning
3. **Conclude**: Synthesize steps into a final answer
4. **Verify**: Check that the conclusion follows from the chain

Format each step as:
```
Step N: [observation] → [reasoning] → [conclusion]
```

### Step 4: Execute ReAct (Reasoning + Action)

For tasks requiring external grounding:

1. **Thought**: State what you need to know or verify
2. **Action**: Execute a tool call to gather information
   ```
   Tool: mcp__mcp-graph__search (query: "<verification_query>")
   ```
3. **Observation**: Analyze the tool output
4. **Repeat**: Continue thought-action-observation until sufficient grounding
5. **Conclude**: Synthesize observations into a grounded answer

### Step 5: Execute Tree-of-Thoughts (ToT)

For exploratory problems:

1. **Generate**: Produce 3-5 candidate approaches
2. **Evaluate**: Score each candidate on feasibility, risk, and alignment with AC
3. **Expand**: Take the top 2 candidates and develop them one level deeper
4. **Prune**: Eliminate candidates that hit dead ends or constraint violations
5. **Select**: Choose the candidate with the highest composite score

Track the tree in memory:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "decision"
  content: "ToT exploration for <task>: Evaluated <N> paths. Selected: <chosen_path>. Rationale: <why>. Pruned: <rejected_paths>."
  tags: ["reasoning", "tree-of-thoughts", "decision-tree"]
```

### Step 6: Execute Graph-of-Thoughts (GoT)

For interdependent problems:

1. **Map**: Identify all sub-problems and their dependencies (graph structure)
2. **Solve independently**: Solve sub-problems with no incoming dependencies first
3. **Propagate**: Feed solutions into dependent sub-problems
4. **Resolve conflicts**: When sub-problem solutions contradict, apply constraint resolution
5. **Merge**: Combine all sub-problem solutions into a coherent whole

Use the graph to track sub-problem structure:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 7: Evaluate and Fallback

After executing the selected strategy, evaluate result quality:

| Signal | Action |
|--------|--------|
| High confidence, coherent result | Accept, proceed to implementation |
| Moderate confidence, minor gaps | Apply secondary strategy to fill gaps |
| Low confidence, contradictions | Escalate to more powerful strategy |
| Failed completely | Fall back: CoT → ReAct → ToT → GoT |

Record strategy effectiveness:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Reasoning strategy <strategy> applied to <task_type>: effectiveness=<score>. Notes: <observations>."
  tags: ["reasoning-engine", "strategy-effectiveness"]
```

## Output Format

```
Reasoning Engine Report
=======================
Task: <title> (<node_id>)
Complexity: <low/medium/high/critical>

Strategy Selected: <CoT|ReAct|ToT|GoT|Hybrid>
Rationale: <why this strategy>

Reasoning Trace:
  Steps: <N>
  Branches Explored: <N> (ToT/GoT only)
  Tool Calls: <N> (ReAct only)
  Conflicts Resolved: <N> (GoT only)

Result Confidence: <0.0-1.0>
Fallback Used: <yes/no>

Key Insights:
  - <insight_1>
  - <insight_2>

Strategy Effectiveness: <score>/10
```

## Anti-Patterns

- Do NOT default to Chain-of-Thought for every task — match strategy to task structure
- Do NOT skip the evaluation step — unvalidated reasoning is unreliable reasoning
- Do NOT explore more than 5 branches in ToT — diminishing returns after 5
- Do NOT use GoT for simple linear tasks — the overhead is not justified
- Do NOT ignore fallback signals — if confidence is low, escalate strategy immediately
- Do NOT discard pruned branches without recording why — they inform future decisions
- Do NOT apply reasoning strategies to trivial tasks (XS) — direct execution is faster
