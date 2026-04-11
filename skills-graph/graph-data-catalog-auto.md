---
name: graph-data-catalog-auto
description: Auto data catalog with metadata discovery, semantic search, and lineage-aware documentation for all graph data assets
triggers:
  - graph-data-catalog-auto
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-data-catalog-auto

Automatically catalogs all data assets within the execution graph, discovering metadata, inferring descriptions, and enabling semantic search across nodes, edges, knowledge entries, and derived datasets. Maintains a living data dictionary with lineage-aware documentation, freshness tracking, and usage analytics.

## When to Use

- When onboarding to a project and needing to understand what data exists and where
- During DESIGN phase to discover existing data assets before creating new ones
- When searching for specific data across multiple stores (graph, knowledge, RAG)
- Before IMPLEMENT to verify if required data already exists or needs to be created
- During REVIEW to audit data documentation completeness
- When data consumers cannot find or understand available datasets

## Mandatory Flow

```
scan all stores → extract metadata → infer descriptions → build catalog entries → enable semantic search → track usage → generate documentation → write_memory
```

## Workflow

### Step 1: Scan All Data Stores

Discover all data assets across every store in the system:

```
Tool: mcp__mcp-graph__search (query: "*")
Tool: mcp__mcp-graph__knowledge_stats ()
Tool: mcp__mcp-graph__rag_context (query: "data asset inventory")
```

Asset sources to scan:
| Source | Asset Type | Discovery Method |
|--------|-----------|-----------------|
| Graph nodes | Tasks, epics, milestones | Query all node types |
| Graph edges | Dependencies, relationships | Query all edge types |
| Knowledge store | Decisions, patterns, memories | Query knowledge categories |
| RAG index | Indexed documents, embeddings | Query index metadata |
| FTS index | Searchable text corpus | Query FTS5 tables |
| Exports | Mermaid diagrams, JSON exports | Scan export directory |
| Schemas | Zod definitions, SQLite DDL | Scan schema files |

### Step 2: Extract Metadata

For each discovered asset, extract structured metadata:

```
Tool: mcp__mcp-graph__search (query: "type:<asset-type>")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Metadata fields per asset:
| Field | Description | Example |
|-------|-------------|---------|
| `name` | Human-readable asset name | "Sprint 3 Task Nodes" |
| `type` | Asset category | node, edge, knowledge, index |
| `schema` | Fields and types | { name: string, status: enum } |
| `record_count` | Number of records | 142 |
| `created_at` | First creation timestamp | 2026-03-15 |
| `updated_at` | Last modification timestamp | 2026-04-09 |
| `size_bytes` | Storage footprint | 45,000 |
| `owner` | Creator or responsible party | "import_prd" |
| `lineage` | Upstream/downstream assets | ["PRD file", "Sprint plan"] |
| `freshness` | Time since last update | "2 hours ago" |
| `access_pattern` | Read/write frequency | "high read, low write" |

### Step 3: Infer Descriptions

Automatically generate descriptions for undocumented assets:

```
Tool: mcp__mcp-graph__rag_context (query: "<asset-name> purpose usage context")
Tool: mcp__mcp-graph__search (query: "description:<asset-name>")
```

Description inference strategies:
- **From field names:** Infer purpose from column/field naming conventions
- **From usage context:** Analyze which tools and workflows consume the asset
- **From lineage:** Describe based on upstream producer and downstream consumers
- **From content sampling:** Sample 5-10 records to understand the data's nature
- **From knowledge store:** Check if existing memories describe the asset

For each asset without a description, generate:
- One-line summary (what is this data?)
- Purpose statement (why does it exist?)
- Key fields explanation (what do the important columns mean?)
- Usage notes (how should consumers use this data?)

### Step 4: Build Catalog Entries

Create structured catalog entries for each asset:

```
Tool: mcp__mcp-graph__write_memory (title: "Catalog — <asset-name>", content: <catalog-entry>)
```

Catalog entry structure:
```
Asset: <name>
Type: <type>
Description: <inferred or documented description>
Schema: <field1: type, field2: type, ...>
Records: <count>
Size: <bytes>
Freshness: <last updated>
Owner: <creator/maintainer>
Lineage:
  - Upstream: <producer assets>
  - Downstream: <consumer assets>
Tags: [<tag1>, <tag2>, ...]
Quality Score: <completeness %>
```

### Step 5: Enable Semantic Search

Index catalog entries for semantic discovery:

```
Tool: mcp__mcp-graph__search (query: "<test-semantic-query>")
Tool: mcp__mcp-graph__rag_context (query: "<test-rag-query>")
```

Search capabilities:
- **Keyword search:** Find assets by exact name or field name
- **Semantic search:** Find assets by meaning ("velocity data" finds sprint metrics)
- **Schema search:** Find assets containing specific field types
- **Lineage search:** Find all assets upstream or downstream of a given asset
- **Freshness search:** Find stale assets not updated within a threshold
- **Tag search:** Browse assets by category tags

Verify search works by running test queries:
- Search for a known asset by name (should return exact match)
- Search for an asset by description keyword (should return relevant results)
- Search for an asset by schema field (should find assets with that field)

### Step 6: Track Usage Analytics

Monitor how catalog assets are accessed and by which tools:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
Tool: mcp__mcp-graph__knowledge_stats ()
```

Usage metrics per asset:
- **Read frequency:** How often is this asset queried?
- **Write frequency:** How often is this asset updated?
- **Consumer count:** How many downstream tools/workflows depend on it?
- **Search hits:** How often does this asset appear in search results?
- **Staleness risk:** Is the update frequency dropping over time?

Flag assets with:
- Zero reads in 30 days (candidate for archival)
- High read, zero write in 14 days (possibly stale)
- Many consumers but no documentation (high-risk undocumented asset)

### Step 7: Generate Data Dictionary

Produce a comprehensive data dictionary from the catalog:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Data dictionary sections:
1. **Executive summary:** Total assets, health scores, coverage statistics
2. **Asset inventory:** Grouped by type with metadata summary
3. **Schema reference:** All schemas with field-level documentation
4. **Lineage map:** Visual representation of data flows
5. **Freshness report:** Assets sorted by staleness
6. **Usage report:** Assets sorted by access frequency
7. **Quality gaps:** Undocumented or poorly described assets

### Step 8: Persist Catalog and Report

Save the complete catalog and generation report:

```
Tool: mcp__mcp-graph__write_memory (title: "Data Catalog — Complete — <date>", content: <full-catalog>)
Tool: mcp__mcp-graph__write_memory (title: "Data Catalog Report — <date>", content: <generation-report>)
```

## Output Format

```
Phase: DATA CATALOG AUTO-GENERATION
Assets Discovered: <N> total
  - Nodes: <N> (tasks: <N>, epics: <N>, milestones: <N>)
  - Edges: <N> (depends_on: <N>, related_to: <N>, parent_of: <N>)
  - Knowledge: <N> entries across <N> categories
  - Indexes: FTS (<N> docs), RAG (<N> vectors)
  - Exports: <N> files
Metadata Completeness: <N>% of assets have full metadata
Description Coverage: <N>% auto-inferred, <N>% manually documented, <N>% undocumented
Semantic Search: <N> test queries passed
Usage Analytics:
  - Active assets (accessed in 7d): <N>
  - Stale assets (no access in 30d): <N>
  - Undocumented high-use: <N> (critical gap)
Data Dictionary: <N> entries generated
Status: COMPLETE | PARTIAL | NEEDS_ENRICHMENT

Saved to memory: "Data Catalog — Complete — <date>"
```

## Anti-Patterns

- Do NOT catalog without metadata extraction — a catalog entry without schema and lineage is useless
- Do NOT rely solely on manual descriptions — auto-infer descriptions for all assets, then allow manual override
- Do NOT ignore stale catalog entries — re-scan periodically to keep the catalog in sync with actual data
- Do NOT skip semantic search validation — if the catalog is not searchable, it will not be used
- Do NOT catalog derived data without linking to source — every derived dataset must reference its transformation lineage
- Do NOT treat the catalog as static documentation — it is a living system that must be refreshed with each data change
- Do NOT ignore usage analytics — zero-use assets clutter the catalog and waste storage
