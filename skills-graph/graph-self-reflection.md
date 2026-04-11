---
name: graph-self-reflection
description: Self-reflection and auto-critique loop for agents — reviews past outputs, identifies hallucinations, and improves reasoning quality
triggers:
  - graph-self-reflection
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-self-reflection

Executes a structured self-reflection and auto-critique loop that reviews past agent outputs, identifies hallucinations and reasoning failures, scores confidence levels, and produces corrective actions. Improves agent accuracy over time by building a persistent error pattern library in the knowledge store.

## When to Use

- After completing a complex implementation task to verify output quality
- When a task receives a low DoD grade (C or D) — to diagnose root cause
- When users report incorrect or misleading agent output
- Proactively after every 5 completed tasks as a quality checkpoint
- When `analyze` reveals recurring error patterns in recent tasks
- Autonomously when confidence in a generated output is below 0.7

## Mandatory Flow

```
rag_context(past_outputs) → critique_output → detect_hallucinations → score_confidence → generate_corrections → write_memory
```

## Workflow

### Step 1: Gather Past Outputs for Review

Retrieve recent task completions and their associated outputs:
```
Tool: mcp__mcp-graph__search (query: "status:done")
```

Load context for each task under review:
```
Tool: mcp__mcp-graph__rag_context (query: "recent task outputs decisions rationale")
```

Collect the following for each output:
- Task description and acceptance criteria
- Implementation rationale (from `finish_task`)
- Code changes made
- Test results
- Any user feedback or corrections

### Step 2: Structured Self-Critique

For each output, apply the critique framework:

| Dimension | Question | Score (1-5) |
|-----------|----------|-------------|
| Factual accuracy | Are all stated facts verifiable in the codebase? | |
| Logical consistency | Does the reasoning chain hold without gaps? | |
| Completeness | Were all acceptance criteria fully addressed? | |
| Relevance | Was the output focused on what was asked? | |
| Hallucination risk | Are there claims not grounded in source material? | |
| Over-confidence | Were uncertainty levels appropriately communicated? | |

Run analysis to check for patterns:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 3: Hallucination Detection

Systematically check for common hallucination categories:

1. **Fabricated references**: Citations to functions, files, or APIs that do not exist
2. **Invented constraints**: Claiming limitations that the system does not have
3. **False dependencies**: Stating dependencies between modules that are not real
4. **Phantom features**: Referencing capabilities that were never implemented
5. **Stale knowledge**: Using outdated information when current data is available

For each suspected hallucination, verify against the codebase:
```
Tool: mcp__mcp-graph__search (query: "<suspected_reference>")
```

Cross-reference with RAG:
```
Tool: mcp__mcp-graph__rag_context (query: "<claim_to_verify>")
```

### Step 4: Confidence Calibration

Score overall confidence for each reviewed output:

| Confidence Level | Range | Action |
|-----------------|-------|--------|
| High | 0.85-1.0 | No action needed |
| Moderate | 0.70-0.84 | Flag for optional human review |
| Low | 0.50-0.69 | Require revision before proceeding |
| Very Low | <0.50 | Block and escalate to user |

Factors that reduce confidence:
- Task involved unfamiliar domain or library
- Multiple assumptions made without verification
- Output contradicts existing patterns in the graph
- Limited RAG context available for the topic

### Step 5: Generate Corrective Actions

For each identified issue, produce a specific corrective action:

1. **Immediate fix**: If the error affects a completed task, create a fix node in the graph
2. **Pattern documentation**: Record the error pattern to prevent recurrence
3. **Process improvement**: Suggest workflow changes (e.g., "always verify imports before referencing")
4. **Knowledge gap**: Identify missing knowledge that should be indexed

Create fix nodes if needed:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 6: Build Error Pattern Library

Persist discovered error patterns for future prevention:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "errors"
  content: "Self-reflection cycle [date]: Found <N> issues. Hallucinations: <list>. Reasoning gaps: <list>. Corrective actions: <list>."
  tags: ["self-reflection", "hallucination-detection", "error-patterns"]
```

### Step 7: Self-Healing Loop

Continuously improve the reflection process itself:

1. Track which error types recur despite previous corrections
2. For recurring errors, escalate the prevention strategy (e.g., from "document pattern" to "add pre-check")
3. Measure improvement trend: error rate should decrease sprint-over-sprint
4. If error rate plateaus, introduce new critique dimensions

```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Reflection meta-analysis: Error rate trend [improving/stable/degrading]. Recurring patterns: <list>. New dimensions added: <list>."
  tags: ["self-reflection", "meta-analysis", "continuous-improvement"]
```

## Output Format

```
Self-Reflection Report
======================
Tasks Reviewed: <N>
Period: <date_range>

Critique Summary:
  Factual Accuracy:    <avg_score>/5
  Logical Consistency: <avg_score>/5
  Completeness:        <avg_score>/5
  Relevance:           <avg_score>/5

Hallucinations Found: <N>
  - <type>: <description> (task: <node_id>)
  - <type>: <description> (task: <node_id>)

Confidence Distribution:
  High:      <N> tasks
  Moderate:  <N> tasks
  Low:       <N> tasks
  Very Low:  <N> tasks

Corrective Actions: <N>
  - <action_type>: <description>

Error Rate Trend: <improving/stable/degrading>
Next Reflection: after <N> tasks
```

## Anti-Patterns

- Do NOT skip self-reflection because "everything looks fine" — blind spots are the whole point
- Do NOT treat confidence scores as binary (good/bad) — use the full gradient for nuanced decisions
- Do NOT only review failed tasks — successful tasks can contain latent hallucinations
- Do NOT generate corrective actions without verifying the issue first — false positives waste effort
- Do NOT delete or hide error patterns from memory — the error library is cumulative and valuable
- Do NOT run reflection on trivial tasks (XS boilerplate) — focus on Standard+ complexity
- Do NOT ignore recurring error patterns — escalate prevention strategy if the same error appears 3+ times
