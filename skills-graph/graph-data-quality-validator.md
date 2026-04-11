---
name: graph-data-quality-validator
description: Continuous data quality validation for completeness, consistency, accuracy, and freshness within the execution graph
triggers:
  - graph-data-quality-validator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-data-quality-validator

Performs continuous data quality validation across the execution graph, checking completeness, consistency, accuracy, and freshness of all graph data — nodes, edges, knowledge entries, and RAG indexes. Proactively detects data quality degradation before it impacts downstream workflows.

## When to Use

- Before VALIDATE phase to ensure graph data integrity meets acceptance criteria
- After bulk imports (`import_prd`) to verify imported data quality
- When knowledge store queries return unexpected or stale results
- During REVIEW phase to audit data completeness before handoff
- Periodically during IMPLEMENT to catch data drift early
- When metrics show anomalies in throughput or error rates

## Mandatory Flow

```
define quality dimensions → scan graph data → check completeness → check consistency → check accuracy → check freshness → score results → report → write_memory
```

## Workflow

### Step 1: Define Quality Dimensions

Establish the quality framework with measurable thresholds:

| Dimension | Description | Threshold |
|-----------|-------------|-----------|
| Completeness | All required fields populated, no orphan nodes | >95% fields filled |
| Consistency | No contradictory statuses, valid state transitions | Zero violations |
| Accuracy | Metadata matches actual state, correct edge types | >98% accuracy |
| Freshness | Data updated within expected cadence | <24h staleness |
| Uniqueness | No duplicate nodes or redundant edges | Zero duplicates |

### Step 2: Scan Graph Data

Collect the current state of all graph data:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
Tool: mcp__mcp-graph__knowledge_stats ()
Tool: mcp__mcp-graph__search (query: "*")
```

Build an inventory of:
- Total nodes by type (epic, task, milestone)
- Total edges by type (depends_on, parent_of, related_to)
- Knowledge entries by category
- RAG index coverage and freshness

### Step 3: Check Completeness

Validate that all required fields are populated:

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Completeness rules:
- Every task node MUST have: `name`, `status`, `priority`, `description`
- Every epic MUST have at least one child task edge
- Every `done` task MUST have acceptance criteria documented
- Every edge MUST have valid `from` and `to` node references
- Knowledge entries MUST have non-empty `content` and `category`

Flag nodes with missing required fields and compute completeness percentage.

### Step 4: Check Consistency

Verify data does not contradict itself:

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
Tool: mcp__mcp-graph__search (query: "blocked OR in_progress")
```

Consistency rules:
- No node can be `done` if any `depends_on` dependency is not `done`
- No node can be `in_progress` if a blocking dependency is `blocked`
- Status transitions must follow: `ready` -> `in_progress` -> `done` (no skipping)
- Edge types must be semantically valid (no `depends_on` from child to parent)
- No circular dependencies in the graph
- Priority values must be from the valid enum set

### Step 5: Check Accuracy

Verify metadata matches actual state:

```
Tool: mcp__mcp-graph__search (query: "type:task status:done")
Tool: mcp__mcp-graph__knowledge_stats ()
```

Accuracy rules:
- `done` tasks should have associated test files or validation records
- Estimated sizes (S/M/L) should correlate with actual cycle times
- Knowledge entries should reference existing nodes (no dangling references)
- Sprint assignments should match the current or past sprints (no future sprints for done tasks)
- Metrics values should be within reasonable bounds (no negative durations)

### Step 6: Check Freshness

Validate data recency and staleness:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Freshness rules:
- `in_progress` tasks not updated in >48h are likely stale — flag for review
- Knowledge entries older than 7 days without refresh should be re-indexed
- RAG index should reflect current codebase state (check last reindex timestamp)
- Sprint data should be current (no active sprint older than 2 weeks without updates)
- Blocked tasks should have a recent blocker reason (not stale blocks from weeks ago)

### Step 7: Score Quality Results

Compute a quality score per dimension and overall:

| Dimension | Weight | Score Formula |
|-----------|--------|---------------|
| Completeness | 30% | (fields_filled / total_required_fields) * 100 |
| Consistency | 25% | 100 - (violations * 10), min 0 |
| Accuracy | 20% | (accurate_records / total_records) * 100 |
| Freshness | 15% | (fresh_records / total_records) * 100 |
| Uniqueness | 10% | 100 - (duplicates * 5), min 0 |

**Quality Grades:**
- **A (90-100):** Production-ready data quality
- **B (75-89):** Minor issues, acceptable for most workflows
- **C (60-74):** Significant gaps, remediation needed before VALIDATE
- **D (45-59):** Poor quality, blocking downstream workflows
- **F (<45):** Critical data quality failure, stop and remediate

### Step 8: Generate Report and Persist

Save the quality validation report:

```
Tool: mcp__mcp-graph__write_memory (title: "Data Quality Report — <date>", content: <report>)
```

## Output Format

```
Phase: DATA QUALITY VALIDATION
Scanned: <N> nodes, <N> edges, <N> knowledge entries
Completeness: <N>% (<N> missing fields across <N> nodes)
Consistency: <N> violations (cycles: <N>, status: <N>, edges: <N>)
Accuracy: <N>% (<N> mismatches detected)
Freshness: <N> stale items (>48h: <N> tasks, >7d: <N> knowledge)
Uniqueness: <N> duplicates detected
Overall Quality Score: <N>/100 (Grade: <A-F>)
Top Issues:
  1. <issue description>
  2. <issue description>
  3. <issue description>
Recommendations: <top 3 remediation actions>

Saved to memory: "Data Quality Report — <date>"
```

## Anti-Patterns

- Do NOT skip quality checks before VALIDATE — data quality issues cascade into false validation results
- Do NOT ignore stale `in_progress` tasks — they indicate abandoned work or missing status updates
- Do NOT treat consistency violations as warnings — circular dependencies and invalid transitions are always errors
- Do NOT run quality checks without saving results — trend analysis requires historical reports in memory
- Do NOT remediate without root cause analysis — fix the process that created bad data, not just the data
- Do NOT set arbitrary thresholds — calibrate quality thresholds based on project maturity and phase
- Do NOT check quality only at phase gates — run continuously during IMPLEMENT to catch drift early
