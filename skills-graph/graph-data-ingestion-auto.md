---
name: graph-data-ingestion-auto
description: Auto-ingest data from external sources including files, APIs, and local databases into the execution graph
triggers:
  - graph-data-ingestion-auto
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-data-ingestion-auto

Automatically ingests data from external sources — local files, APIs, and databases — into the execution graph as structured nodes and knowledge entries. Detects source format, applies schema validation, handles incremental updates, and maintains ingestion provenance for full traceability.

## When to Use

- When new data sources need to be onboarded into the graph (CSV, JSON, YAML, SQL exports)
- During ANALYZE phase to import requirements from external systems
- When external API data must be captured and tracked as graph nodes
- After receiving data exports from third-party tools that need graph integration
- When local database tables need to be synchronized into the knowledge store
- During IMPLEMENT to auto-ingest test fixtures or seed data

## Mandatory Flow

```
discover sources → detect format → validate schema → map to graph structure → ingest records → create provenance nodes → verify completeness → write_memory
```

## Workflow

### Step 1: Discover Data Sources

Scan for available data sources and assess ingestion candidates:

```
Tool: mcp__mcp-graph__search (query: "import OR ingest OR source OR external OR data file OR api")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Source discovery checklist:
- **Local files:** Scan project directories for CSV, JSON, YAML, XML, Markdown files
- **APIs:** Check for configured endpoints in project settings or environment
- **Databases:** Detect local SQLite databases outside the graph store
- **Clipboard/stdin:** Accept ad-hoc data from user input
- **Previously ingested:** Check memory for past ingestion records to detect updates

### Step 2: Detect Source Format

Automatically detect the format and structure of each source:

| Format | Detection Method | Parser |
|--------|-----------------|--------|
| CSV | File extension + header row detection | Column mapping |
| JSON | File extension + valid JSON parse | Schema inference |
| YAML | File extension + valid YAML parse | Schema inference |
| Markdown | File extension + heading structure | Section parser |
| SQLite | File header magic bytes | Table introspection |
| API JSON | Content-Type header | Response schema inference |

For each source, extract:
- Field names and types (string, number, boolean, date, nested object)
- Record count and approximate size
- Encoding and delimiter (for CSV)
- Nesting depth (for JSON/YAML)

### Step 3: Validate Source Schema

Validate the source data against expected or inferred schema:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Validation rules:
- All required fields present in every record
- Data types conform to inferred or specified schema
- No duplicate primary keys or identifiers
- Date/time fields parse to valid timestamps
- Numeric fields within expected ranges
- String fields within length limits
- Foreign key references resolve to existing records

Collect validation errors per record. If error rate > 5%, halt and report before ingesting.

### Step 4: Map to Graph Structure

Define the mapping from source records to graph entities:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Ingestion Mapping — <source>", type: "task", metadata: { source: "<source-path>", format: "<format>", mapping: { record_field: "graph_field" } })
```

Mapping strategies:
| Source Record | Graph Entity | Strategy |
|--------------|--------------|----------|
| Requirement/story | Task node | Map title, description, priority, AC |
| Dependency list | Edge set | Map from/to relationships as `depends_on` |
| Configuration | Knowledge entry | Map key-value pairs as metadata |
| Metric data | Node metadata | Attach as structured metadata on existing nodes |
| Document section | Knowledge entry + RAG index | Chunk and index for search |

### Step 5: Ingest Records

Execute the ingestion, creating graph entities for each valid record:

```
Tool: mcp__mcp-graph__node (action: "add", name: "<record-name>", type: "<mapped-type>", priority: "<mapped-priority>", metadata: { source: "<source>", ingested_at: "<timestamp>" })
```

For bulk ingestion:
- Process records in batches of 50 for transaction safety
- Track progress: records processed, created, skipped, failed
- Handle duplicates: skip if identical, update if changed, flag if conflicting
- Maintain insertion order for reproducibility

Wire relationships between ingested nodes:

```
Tool: mcp__mcp-graph__edge (from: "<node-a-id>", to: "<node-b-id>", type: "depends_on")
```

### Step 6: Create Provenance Nodes

Track ingestion provenance for auditability:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Ingestion Record — <source> — <date>", type: "task", metadata: { source_path: "<path>", format: "<format>", records_total: <N>, records_ingested: <N>, records_skipped: <N>, records_failed: <N>, checksum: "<hash>" })
```

Link provenance to all ingested nodes:

```
Tool: mcp__mcp-graph__edge (from: "<provenance-id>", to: "<ingested-node-id>", type: "related_to")
```

### Step 7: Verify Ingestion Completeness

Validate the ingestion result:

```
Tool: mcp__mcp-graph__search (query: "source:<source-name> ingested_at:<date>")
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Completeness checks:
- Record count in graph matches source record count (minus expected skips)
- All relationships from source are represented as graph edges
- No orphan nodes created without proper parent/epic linkage
- Knowledge entries are indexed and searchable
- Provenance node accurately reflects ingestion statistics

### Step 8: Report and Persist

Save the ingestion report to memory:

```
Tool: mcp__mcp-graph__write_memory (title: "Data Ingestion — <source> — <date>", content: <report>)
```

## Output Format

```
Phase: DATA INGESTION
Source: <source-path> (<format>, <size>)
Schema: <N> fields detected (<N> required, <N> optional)
Validation: <N> records valid, <N> rejected (error rate: <N>%)
Ingestion:
  - Records processed: <N>
  - Nodes created: <N>
  - Edges created: <N>
  - Knowledge entries: <N>
  - Duplicates skipped: <N>
  - Failures: <N>
Provenance: Node <provenance-id> linked to <N> ingested entities
Completeness: <N>% (<source-count> source → <graph-count> graph)
Status: COMPLETE | PARTIAL | FAILED
Recommendations: <top 3 actions>

Saved to memory: "Data Ingestion — <source> — <date>"
```

## Anti-Patterns

- Do NOT ingest data without schema validation — bad data in the graph corrupts all downstream analysis
- Do NOT skip duplicate detection — re-ingesting the same source creates ghost nodes and broken edge counts
- Do NOT ingest without provenance tracking — untraceable data in the graph cannot be audited or rolled back
- Do NOT process all records in a single transaction — use batches for resilience against partial failures
- Do NOT ignore encoding issues — UTF-8 is the standard; detect and convert other encodings before ingesting
- Do NOT ingest large files without streaming — loading entire files into memory causes OOM for large datasets
- Do NOT skip the completeness check — silent data loss during ingestion is worse than a visible failure
