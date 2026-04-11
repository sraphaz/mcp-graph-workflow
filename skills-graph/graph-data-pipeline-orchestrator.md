---
name: graph-data-pipeline-orchestrator
description: Auto ETL/ELT pipeline orchestration in the graph with tasks, artifacts, dependencies, and execution reports
triggers:
  - graph-data-pipeline-orchestrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-data-pipeline-orchestrator

Orchestrates ETL/ELT pipelines as first-class graph structures, decomposing data workflows into atomic tasks with explicit dependencies, artifact tracking, and execution reports. Proactively detects pipeline failures, bottlenecks, and stale data by monitoring task status and metrics within the execution graph.

## When to Use

- When a data pipeline needs to be modeled as a dependency graph with extract, transform, and load stages
- Before IMPLEMENT phase for any feature involving multi-step data processing
- When pipeline execution order must be enforced via dependency edges
- When artifact lineage (source file, transformed output, loaded target) must be tracked per task
- After pipeline failures to diagnose which stage broke and cascade status updates
- During VALIDATE to verify end-to-end pipeline correctness and data freshness

## Mandatory Flow

```
detect pipeline scope → decompose stages → create nodes → wire edges → execute with next → monitor metrics → validate output → report → write_memory
```

## Workflow

### Step 1: Detect Pipeline Scope

Analyze the pipeline requirements by searching existing graph nodes and knowledge:

```
Tool: mcp__mcp-graph__search (query: "pipeline OR etl OR elt OR extract OR transform OR load")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Identify:
- Data sources (files, APIs, databases, event streams)
- Transformation rules (mapping, filtering, aggregation, enrichment)
- Target destinations (SQLite tables, knowledge store, export files)
- SLA requirements (freshness, latency, completeness thresholds)

### Step 2: Decompose into Pipeline Stages

Break the pipeline into atomic tasks following the extract-transform-load pattern:

| Stage | Task Type | Description |
|-------|-----------|-------------|
| Extract | `data-extract` | Pull raw data from source, validate schema |
| Validate | `data-validate` | Check completeness, nulls, type conformance |
| Transform | `data-transform` | Apply business rules, normalization, enrichment |
| Load | `data-load` | Write to target store, update indexes |
| Verify | `data-verify` | End-to-end assertion on loaded data |

Each stage becomes a graph node with size S or M (never larger than 2h of work).

### Step 3: Create Pipeline Nodes

Create nodes for each pipeline stage:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Extract — <source>", type: "task", priority: "high", metadata: { stage: "extract", source: "<source>" })
Tool: mcp__mcp-graph__node (action: "add", name: "Transform — <rule>", type: "task", priority: "high", metadata: { stage: "transform", rule: "<rule>" })
Tool: mcp__mcp-graph__node (action: "add", name: "Load — <target>", type: "task", priority: "high", metadata: { stage: "load", target: "<target>" })
```

Group stages under an Epic node representing the full pipeline:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Pipeline: <pipeline-name>", type: "epic")
```

### Step 4: Wire Dependency Edges

Create edges enforcing execution order. Each stage depends on its predecessor:

```
Tool: mcp__mcp-graph__edge (from: "<extract-id>", to: "<validate-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<validate-id>", to: "<transform-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<transform-id>", to: "<load-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<load-id>", to: "<verify-id>", type: "depends_on")
```

For parallel branches (e.g., multiple sources), wire fan-in edges to the transform stage.

### Step 5: Execute Pipeline via Graph

Use the `next` tool to pull tasks in dependency order:

```
Tool: mcp__mcp-graph__next ()
Tool: mcp__mcp-graph__update_status (nodeId: "<task-id>", status: "in_progress")
```

Implement each stage following TDD. After completion:

```
Tool: mcp__mcp-graph__update_status (nodeId: "<task-id>", status: "done")
```

### Step 6: Monitor Pipeline Metrics

Track pipeline health with real-time metrics:

```
Tool: mcp__mcp-graph__metrics ()
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Key metrics to track:
- **Stage duration:** Time from `in_progress` to `done` per stage
- **Pipeline throughput:** Records processed per minute
- **Error rate:** Failed validations / total records
- **Data freshness:** Time since last successful pipeline completion

### Step 7: Validate Pipeline Output

Run end-to-end validation on the loaded data:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Assertions:
- Row counts match between source and target (accounting for filters)
- No null values in required fields
- Referential integrity between related datasets
- Timestamps within expected freshness window

### Step 8: Generate Pipeline Report and Persist

Save the pipeline execution report to memory:

```
Tool: mcp__mcp-graph__write_memory (title: "Pipeline Report — <pipeline-name> — <date>", content: <report>)
```

## Output Format

```
Phase: DATA PIPELINE ORCHESTRATION
Pipeline: <pipeline-name>
Stages: <N> (Extract: <N>, Transform: <N>, Load: <N>, Verify: <N>)
Nodes Created: <N> tasks + <N> edges
Execution Order: <stage1> → <stage2> → ... → <stageN>
Duration: <total>s (Extract: <N>s, Transform: <N>s, Load: <N>s)
Records: <N> extracted, <N> transformed, <N> loaded
Errors: <N> validation failures, <N> load errors
Data Freshness: <N>min since last completion
Status: PASS | FAIL | PARTIAL
Recommendations: <top 3 actions>

Saved to memory: "Pipeline Report — <pipeline-name> — <date>"
```

## Anti-Patterns

- Do NOT create monolithic pipeline tasks — decompose into atomic stages (S/M size)
- Do NOT skip dependency edges — pipeline stages MUST execute in order via graph edges
- Do NOT ignore validation stages — every pipeline needs extract validation and load verification
- Do NOT hardcode source paths — use metadata on nodes to parameterize sources and targets
- Do NOT run pipelines without metrics — always monitor duration, throughput, and error rate
- Do NOT leave failed stages in `in_progress` — update to `blocked` or `ready` for retry
- Do NOT skip write_memory — pipeline execution history is critical for debugging regressions
