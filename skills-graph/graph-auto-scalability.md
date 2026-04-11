---
name: graph-auto-scalability
description: Automatic local scalability — detects load increases and auto-scales worker pools, graph partitioning, and query optimization for sustained performance
triggers:
  - graph-auto-scalability
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-auto-scalability

Automatic local scalability for the mcp-graph execution environment. Detects load increases (growing graph size, slower queries, knowledge base expansion) and auto-scales by optimizing worker pools, partitioning graphs, tuning queries, and managing cache eviction. Operates autonomously to maintain consistent performance as the project grows.

## When to Use

- Proactively triggered when graph node count exceeds a growth threshold (every +100 nodes)
- When query response times exceed 500ms for any MCP tool
- When the knowledge base exceeds 1000 entries and retrieval latency increases
- When SQLite database file size grows >50MB
- The user says "scale", "optimize queries", "graph is slow", or "auto-scalability"
- Autonomously triggered when `metrics` shows response time degradation >30% over baseline

## Mandatory Flow

```
measure(baseline metrics) → detect(load signals) → scale(apply optimizations) → verify(performance check) → write_memory
```

## Workflow

### Step 1: Measure — Establish Performance Baseline

Collect current performance metrics to establish or update the baseline:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__knowledge_stats
```

Baseline metrics to capture:

| Metric | How to Measure | Healthy Threshold |
|--------|---------------|-------------------|
| Graph node count | `metrics` total nodes | N/A (growth is expected) |
| Graph edge count | `metrics` total edges | Ratio < 5:1 edges-to-nodes |
| Average tool response time | `metrics` avg latency | < 200ms |
| P95 tool response time | `metrics` p95 latency | < 500ms |
| Knowledge entry count | `knowledge_stats` | N/A (growth expected) |
| RAG retrieval latency | `knowledge_stats` avg query time | < 300ms |
| SQLite DB file size | File system check | < 100MB |
| FTS5 index size | `knowledge_stats` | < 50MB |

### Step 2: Detect — Identify Scaling Triggers

Analyze metrics against thresholds and historical baselines:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Scaling trigger matrix:

| Trigger | Condition | Action Category |
|---------|-----------|-----------------|
| Node count >500 | Large graph traversals slow | Graph partitioning |
| Edge count >2500 | Dependency resolution slow | Index optimization |
| Tool response >500ms | User experience degrades | Query optimization |
| Knowledge entries >1000 | RAG retrieval slow | Knowledge partitioning |
| DB size >50MB | I/O becomes bottleneck | Database maintenance |
| FTS5 queries >300ms | Search results slow | Index rebuild |
| Memory usage >512MB | Process at risk of OOM | Cache eviction tuning |

If no triggers are active, record the healthy baseline and exit early.

### Step 3: Scale — Apply Optimizations

Apply optimizations based on detected triggers. Execute in priority order (highest impact first):

**3a. Query Optimization**

Identify slow queries by analyzing tool response patterns:
```
Tool: mcp__mcp-graph__metrics
```

Common query optimizations:
- Add missing SQLite indexes on frequently filtered columns (status, type, priority)
- Replace sequential `getNodeById` calls with batch `WHERE id IN (...)` queries
- Enable WAL mode for concurrent read/write: `PRAGMA journal_mode=WAL`
- Tune page size and cache size: `PRAGMA cache_size=-64000` (64MB)

**3b. Graph Partitioning**

For graphs with >500 nodes, partition by epic/phase:
```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Partitioning strategies:
- Archive completed epics (status `done` for all children) to separate tables
- Create materialized views for common query patterns (active tasks, blocked tasks)
- Index nodes by phase for phase-specific queries

**3c. Knowledge Base Optimization**

```
Tool: mcp__mcp-graph__knowledge_stats
```

For knowledge bases >1000 entries:
- Compact stale entries (merge duplicates, remove outdated)
- Re-index with optimized FTS5 tokenizer settings
- Tune BM25 parameters based on retrieval quality feedback

```
Tool: mcp__mcp-graph__reindex_knowledge
```

**3d. Cache Tuning**

Review cache configurations:
- Ensure all caches have `maxSize` and TTL configured
- Adjust cache hit ratio — if <60%, increase cache size or improve key strategy
- Evict low-priority entries when memory pressure is detected
- Separate hot (frequently accessed) and cold (rarely accessed) data

**3e. Database Maintenance**

For databases >50MB:
- Run `VACUUM` to reclaim space from deleted rows
- Run `ANALYZE` to update query planner statistics
- Verify WAL checkpoint is running (auto-checkpoint at 1000 pages)
- Check for table fragmentation

### Step 4: Verify — Confirm Performance Improvement

Re-measure all metrics after optimizations:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__knowledge_stats
```

Verification criteria:

| Metric | Must Be | Compared To |
|--------|---------|-------------|
| Avg tool response | <= pre-optimization | Baseline from Step 1 |
| P95 tool response | < 500ms | Absolute threshold |
| RAG retrieval | <= pre-optimization | Baseline from Step 1 |
| No functional regression | All tools working | Run `analyze(status_flow)` |

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

If any metric regressed after optimization, roll back that specific change and investigate.

### Step 5: Record Scaling Actions

Save the scaling report and updated baselines:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Auto-Scalability Report — <date>"
  content: "<triggers detected, optimizations applied, before/after metrics, new baselines>"
  tags: ["scalability", "performance", "optimization", "auto-scale"]
```

Update the baseline in memory for future comparison:
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Performance Baseline — <date>"
  content: "<all current metrics as new baseline>"
  tags: ["baseline", "metrics", "scalability"]
```

## Output Format

```
Phase: AUTO-SCALABILITY
Loop: Measure -> Detect -> Scale -> Verify

Baseline:
  Nodes: <N> | Edges: <N> | DB size: <N>MB
  Avg response: <N>ms | P95: <N>ms
  Knowledge entries: <N> | RAG latency: <N>ms

Triggers:
  Active: <N> (details per trigger)
  Priority: <ordered list>

Optimizations Applied:
  Query optimization: <yes/no> — <details>
  Graph partitioning: <yes/no> — <details>
  Knowledge optimization: <yes/no> — <details>
  Cache tuning: <yes/no> — <details>
  DB maintenance: <yes/no> — <details>

Verification:
  Avg response: <N>ms (delta: <+/-N>ms)
  P95 response: <N>ms (delta: <+/-N>ms)
  RAG latency: <N>ms (delta: <+/-N>ms)
  Functional: <passed/failed>

Saved to memory: "Auto-Scalability Report — <date>"
New baseline saved: "Performance Baseline — <date>"
```

## Anti-Patterns

- Do NOT optimize without measuring first — always establish a baseline before changing anything
- Do NOT run VACUUM on a database during active write operations — schedule for idle periods
- Do NOT increase cache sizes unboundedly — always set maxSize to prevent OOM
- Do NOT partition graphs prematurely — only when node count >500 or response times degrade
- Do NOT drop indexes to save space — indexes are critical for query performance
- Do NOT skip verification after scaling — every optimization must prove its value with numbers
- Do NOT apply all optimizations at once — apply sequentially and measure each one to isolate impact
