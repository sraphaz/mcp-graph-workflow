---
name: graph-local-data-lake-manager
description: Local data lake organization, partitioning, versioning, and lifecycle management within the graph workflow
triggers:
  - graph-local-data-lake-manager
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-local-data-lake-manager

Manages a local data lake organized around the execution graph, handling data partitioning, versioning, lifecycle policies, and storage optimization. Treats the `workflow-graph/` directory and its associated stores (SQLite, knowledge, RAG indexes) as a structured data lake with zones, retention policies, and access patterns — all tracked as graph nodes.

## When to Use

- When the local data store grows beyond manageable size and needs partitioning
- During PLAN phase to design data retention and archival strategies
- When multiple data sources need unified organization under a single namespace
- After extended project runs where stale data accumulates in the knowledge store
- Before DEPLOY to optimize storage footprint and index performance
- When historical data must be preserved but separated from active working sets

## Mandatory Flow

```
audit current storage → define zones → partition data → apply versioning → set retention policies → optimize indexes → validate organization → write_memory
```

## Workflow

### Step 1: Audit Current Storage

Assess the current state of all local data stores:

```
Tool: mcp__mcp-graph__knowledge_stats ()
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Inventory dimensions:
| Store | Location | Measure |
|-------|----------|---------|
| Graph DB | `workflow-graph/graph.db` | Tables, rows, size on disk |
| Knowledge store | Knowledge tables in graph.db | Entries by category, total size |
| RAG index | Embedding tables | Vectors count, index size |
| FTS index | FTS5 tables | Indexed documents, index size |
| Exports | `workflow-graph/exports/` | Mermaid/JSON files, count and size |
| Memory files | Written memories | Count, total size, age distribution |

Compute storage health metrics:
- Total disk usage across all stores
- Growth rate (size delta over last 7/30 days)
- Stale data percentage (untouched for >30 days)
- Index-to-data ratio (indexes should be <50% of data size)

### Step 2: Define Data Lake Zones

Organize data into structured zones following the medallion architecture:

| Zone | Purpose | Data Characteristics | Retention |
|------|---------|---------------------|-----------|
| **Raw** | Unprocessed ingestion data | Original format, immutable | 90 days |
| **Bronze** | Validated and typed data | Schema-validated, lightly cleaned | 60 days |
| **Silver** | Transformed and enriched data | Business rules applied, normalized | 30 days active, archive after |
| **Gold** | Aggregated and analytics-ready | Metrics, reports, dashboards | Indefinite |
| **Archive** | Historical snapshots | Compressed, read-only | Indefinite |

```
Tool: mcp__mcp-graph__node (action: "add", name: "Data Lake Zone — Raw", type: "task", metadata: { zone: "raw", retention_days: 90 })
Tool: mcp__mcp-graph__node (action: "add", name: "Data Lake Zone — Silver", type: "task", metadata: { zone: "silver", retention_days: 30 })
Tool: mcp__mcp-graph__node (action: "add", name: "Data Lake Zone — Gold", type: "task", metadata: { zone: "gold", retention_days: -1 })
```

### Step 3: Partition Data

Partition data within each zone for efficient access:

```
Tool: mcp__mcp-graph__search (query: "created_at OR sprint OR phase OR type")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Partitioning strategies:
- **By time:** Monthly partitions for historical data (YYYY-MM)
- **By phase:** Group data by lifecycle phase (IMPLEMENT, VALIDATE, REVIEW)
- **By sprint:** Separate data per sprint iteration
- **By type:** Partition by entity type (tasks, knowledge, metrics, exports)
- **By status:** Separate active (ready, in_progress) from completed (done) data

Partition metadata recorded on zone nodes:

```
Tool: mcp__mcp-graph__node (action: "update", id: "<zone-node-id>", metadata: { partitions: ["2026-01", "2026-02", "2026-03"], partition_key: "created_at_month" })
```

### Step 4: Apply Versioning

Implement data versioning for change tracking and rollback:

Version strategy:
- **Snapshot versioning:** Full copy of data state at each version point
- **Delta versioning:** Store only changes between versions (more space-efficient)
- **Semantic versioning:** Major.Minor.Patch for schema-breaking vs. additive changes

```
Tool: mcp__mcp-graph__node (action: "add", name: "Data Version — v<N> — <date>", type: "task", metadata: { version: "<N>", snapshot_type: "delta", base_version: "<N-1>" })
```

Version triggers:
- Before schema migrations (automatic snapshot)
- Before bulk data operations (import, delete, transform)
- At sprint boundaries (periodic snapshot)
- Before DEPLOY phase (release snapshot)

### Step 5: Set Retention Policies

Define and enforce data retention policies per zone:

```
Tool: mcp__mcp-graph__search (query: "zone:raw created_at:<90-days-ago>")
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Retention actions:
| Age Threshold | Action | Target |
|--------------|--------|--------|
| >90 days in Raw | Delete or archive | Raw ingestion records |
| >60 days in Bronze | Compress and archive | Validated but unprocessed records |
| >30 days inactive in Silver | Move to Archive | Enriched data not accessed recently |
| Never | Preserve | Gold zone metrics and reports |

Archive process:
1. Verify no active references to data being archived
2. Export data to compressed format (JSON.gz)
3. Update graph nodes to reflect archived status
4. Remove from active indexes to improve query performance
5. Keep archive manifest in Gold zone for discoverability

### Step 6: Optimize Indexes

Rebuild and optimize indexes based on current access patterns:

```
Tool: mcp__mcp-graph__knowledge_stats ()
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Optimization tasks:
- **FTS5 rebuild:** Rebuild full-text search index after bulk deletions or archival
- **WAL checkpoint:** Force SQLite WAL checkpoint to reclaim disk space
- **Vacuum:** Run SQLite VACUUM after significant data removal
- **Index analysis:** Check which indexes are used vs. unused, drop dead indexes
- **Cache warming:** Pre-populate caches for frequently accessed Gold zone data

### Step 7: Validate Organization

Verify the data lake organization is consistent and complete:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
Tool: mcp__mcp-graph__search (query: "zone:* partition:*")
```

Validation checks:
- Every data record belongs to exactly one zone
- No data exists outside of defined zones (no "swamp" data)
- Partition keys are consistent within each zone
- Version chain is unbroken (no missing intermediate versions)
- Retention policies are applied (no overdue data in active zones)
- Indexes reflect current data state (no stale index entries)

### Step 8: Report and Persist

Save the data lake management report:

```
Tool: mcp__mcp-graph__write_memory (title: "Data Lake Report — <date>", content: <report>)
```

## Output Format

```
Phase: DATA LAKE MANAGEMENT
Storage Audit:
  - Graph DB: <N>MB (<N> tables, <N> rows)
  - Knowledge: <N> entries (<N>MB)
  - RAG Index: <N> vectors (<N>MB)
  - FTS Index: <N> documents (<N>MB)
  - Total: <N>MB (growth: <+/-N>MB/week)
Zones: Raw (<N>MB), Bronze (<N>MB), Silver (<N>MB), Gold (<N>MB), Archive (<N>MB)
Partitions: <N> active partitions across <N> zones
Versions: <N> snapshots, latest: v<N> (<date>)
Retention: <N> records archived, <N> records deleted, <N>MB reclaimed
Index Optimization: <N> indexes rebuilt, <N>MB reclaimed
Stale Data: <N>% of total (target: <10%)
Status: HEALTHY | NEEDS_ATTENTION | CRITICAL

Saved to memory: "Data Lake Report — <date>"
```

## Anti-Patterns

- Do NOT let the data lake become a data swamp — every record must belong to a defined zone with retention policy
- Do NOT skip versioning before destructive operations — always snapshot before bulk deletes or schema migrations
- Do NOT optimize indexes during active pipeline execution — schedule optimization during quiet periods
- Do NOT archive data without verifying no active references — dangling references corrupt graph integrity
- Do NOT apply retention policies without audit — always log what was deleted/archived for compliance
- Do NOT ignore growth rate trends — exponential storage growth indicates a missing retention policy or duplicate ingestion
- Do NOT store derived data in Raw zone — keep zones semantically clean for predictable data quality
