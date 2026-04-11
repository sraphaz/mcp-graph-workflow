---
name: graph-data-transformation-engine
description: SQL-like and graph-based data transformation engine for filtering, aggregation, enrichment, and reshaping within the graph
triggers:
  - graph-data-transformation-engine
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-data-transformation-engine

Provides a SQL-like and graph-based data transformation engine that operates directly on execution graph data. Supports filtering, aggregation, enrichment, joins, pivots, and reshaping of nodes, edges, and knowledge entries — producing derived datasets without modifying source data.

## When to Use

- When graph data needs to be filtered, aggregated, or reshaped for reporting or analysis
- During REVIEW phase to compute derived metrics from raw task data
- When knowledge entries need enrichment from graph context or RAG sources
- Before VALIDATE to transform raw test results into structured assertions
- When cross-referencing multiple data sources within the graph (joins)
- During PLAN to aggregate historical velocity data for sprint forecasting

## Mandatory Flow

```
define transformation → identify source data → apply operations → validate output → materialize results → index for search → write_memory
```

## Workflow

### Step 1: Define Transformation

Specify the transformation using a declarative operation set:

| Operation | Description | SQL Equivalent |
|-----------|-------------|----------------|
| `filter` | Select records matching criteria | `WHERE` |
| `project` | Select specific fields from records | `SELECT col1, col2` |
| `aggregate` | Group and compute summaries | `GROUP BY ... SUM/AVG/COUNT` |
| `join` | Combine data from multiple sources | `JOIN ... ON` |
| `enrich` | Add fields from external context | `LEFT JOIN` with lookup |
| `pivot` | Reshape rows into columns | `PIVOT` / `CASE WHEN` |
| `sort` | Order results | `ORDER BY` |
| `deduplicate` | Remove duplicate records | `DISTINCT` |

Define the transformation as a pipeline of ordered operations.

### Step 2: Identify Source Data

Locate the source data for the transformation:

```
Tool: mcp__mcp-graph__search (query: "<source-data-criteria>")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Source types:
- **Node set:** All tasks matching a filter (status, type, priority, sprint)
- **Edge set:** All dependencies of a specific type
- **Knowledge set:** Knowledge entries matching a category or tag
- **RAG results:** Contextual data retrieved by semantic search
- **Metric set:** Historical metrics data from pipeline executions

```
Tool: mcp__mcp-graph__rag_context (query: "<semantic-search-for-source-data>")
```

### Step 3: Apply Filter Operations

Filter source data to the relevant subset:

```
Tool: mcp__mcp-graph__search (query: "status:done type:task sprint:<current>")
```

Filter expressions:
- **Equality:** `status = "done"`, `type = "task"`
- **Range:** `priority >= "high"`, `created_at > "2026-01-01"`
- **Pattern:** `name LIKE "%migration%"`, `description CONTAINS "schema"`
- **Set membership:** `status IN ("done", "in_progress")`
- **Null check:** `description IS NOT NULL`, `metadata.testFiles EXISTS`
- **Negation:** `status != "blocked"`, `type NOT IN ("epic")`

### Step 4: Apply Aggregate Operations

Compute summaries from filtered data:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Aggregation functions:
| Function | Input | Output | Example |
|----------|-------|--------|---------|
| `COUNT` | Record set | Integer | Tasks per status |
| `SUM` | Numeric field | Number | Total story points per sprint |
| `AVG` | Numeric field | Number | Average cycle time |
| `MIN/MAX` | Comparable field | Value | Earliest/latest completion date |
| `GROUP_CONCAT` | String field | Delimited list | All assignees per epic |
| `PERCENTILE` | Numeric field | Number | P95 cycle time |

Group-by dimensions:
- By status: `ready`, `in_progress`, `done`, `blocked`
- By type: `epic`, `task`, `milestone`
- By sprint: Sprint number or date range
- By phase: ANALYZE, DESIGN, PLAN, IMPLEMENT, VALIDATE, REVIEW

### Step 5: Apply Enrichment Operations

Enrich data with context from RAG and knowledge store:

```
Tool: mcp__mcp-graph__rag_context (query: "<enrichment-context>")
Tool: mcp__mcp-graph__search (query: "knowledge category:<relevant-category>")
```

Enrichment sources:
- **RAG context:** Semantic search for related documentation, decisions, patterns
- **Knowledge entries:** Lookup technical decisions, architecture notes, error patterns
- **Graph traversal:** Walk dependency edges to add parent/child context
- **Computed fields:** Derive new fields from existing data (cycle time = done - started)

### Step 6: Apply Join Operations

Combine data from multiple graph sources:

Join strategies:
| Join Type | Description | Use Case |
|-----------|-------------|----------|
| Inner join | Records matching in both sets | Tasks with matching knowledge entries |
| Left join | All from left, matching from right | All tasks with optional metrics |
| Cross join | Cartesian product | Compare all tasks against all criteria |
| Graph join | Follow edges to related nodes | Task with all its dependencies |

```
Tool: mcp__mcp-graph__search (query: "type:task")
Tool: mcp__mcp-graph__search (query: "type:knowledge category:decision")
```

### Step 7: Validate and Materialize Output

Validate the transformation output before materializing:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Validation rules:
- Output record count matches expected (based on input count and operations)
- No null values in required output fields
- Aggregation totals are consistent (e.g., group counts sum to total)
- Enrichment success rate > 90% (most records enriched)
- No duplicate records in output (unless explicitly allowed)

Materialize results as knowledge entries or node metadata:

```
Tool: mcp__mcp-graph__write_memory (title: "Transformation Output — <name> — <date>", content: <materialized-results>)
```

### Step 8: Index for Search and Persist

Ensure transformed data is discoverable:

```
Tool: mcp__mcp-graph__search (query: "transformation:<name>")
Tool: mcp__mcp-graph__write_memory (title: "Transformation Report — <name> — <date>", content: <report>)
```

## Output Format

```
Phase: DATA TRANSFORMATION
Transformation: <name>
Source: <N> records from <source-description>
Operations Applied:
  1. FILTER: <criteria> → <N> records
  2. AGGREGATE: <function> BY <dimension> → <N> groups
  3. ENRICH: <source> → <N>/<N> enriched (<N>%)
  4. JOIN: <left> x <right> → <N> joined records
  5. SORT: <field> <direction>
Output: <N> records, <N> fields per record
Validation: <N> checks passed, <N> warnings
Materialized: <location> (memory | node metadata | knowledge)
Status: COMPLETE | PARTIAL | FAILED

Saved to memory: "Transformation Report — <name> — <date>"
```

## Anti-Patterns

- Do NOT modify source data during transformation — transformations produce new derived data, never mutate originals
- Do NOT chain more than 7 operations without intermediate validation — complex pipelines need checkpoints
- Do NOT skip output validation — incorrect aggregations silently corrupt downstream analysis
- Do NOT ignore null handling — decide explicitly whether to filter, default, or propagate nulls for each field
- Do NOT materialize without indexing — transformed data that cannot be found is wasted computation
- Do NOT apply transformations without documenting the logic — future audits require reproducible transformation definitions
- Do NOT use joins on large datasets without filtering first — filter early in the pipeline to reduce join cardinality
