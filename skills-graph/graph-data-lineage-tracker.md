---
name: graph-data-lineage-tracker
description: Data provenance and lineage tracking between tasks, phases, nodes, and artifacts across the execution graph
triggers:
  - graph-data-lineage-tracker
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-data-lineage-tracker

Tracks data provenance and lineage across the entire execution graph, mapping how data flows between tasks, phases, and nodes. Establishes end-to-end traceability from raw input to final output, enabling impact analysis, root cause diagnosis, and regulatory compliance through graph-native lineage edges.

## When to Use

- Before modifying shared data structures to understand downstream impact
- During REVIEW phase to audit data flow and verify no untracked transformations
- After a data quality issue to trace the root cause back to the originating stage
- When onboarding new team members who need to understand data dependencies
- During VALIDATE to verify all data transformations are documented and traceable
- Before HANDOFF to generate a complete lineage map for the deliverable

## Mandatory Flow

```
identify data assets → scan graph for data flow → build lineage edges → detect gaps → visualize lineage → validate completeness → export lineage map → write_memory
```

## Workflow

### Step 1: Identify Data Assets

Catalog all data assets in the project by searching the graph:

```
Tool: mcp__mcp-graph__search (query: "data OR schema OR table OR store OR index OR file OR export")
```

Classify each asset:
- **Source:** Raw inputs (PRD files, imported data, external APIs)
- **Intermediate:** Transformed data (parsed nodes, enriched metadata, computed metrics)
- **Target:** Final outputs (SQLite tables, exported files, knowledge entries, API responses)
- **Reference:** Static lookup data (configuration, schemas, enum definitions)

### Step 2: Scan Graph for Data Flow

Analyze existing graph edges and node metadata to detect data flow patterns:

```
Tool: mcp__mcp-graph__search (query: "transform OR parse OR convert OR enrich OR aggregate OR import OR export")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For each task node, identify:
- **Inputs:** What data does this task consume? (files read, nodes queried, APIs called)
- **Outputs:** What data does this task produce? (files written, nodes created, stores updated)
- **Transformations:** What changes are applied? (mapping, filtering, aggregation, enrichment)

### Step 3: Build Lineage Edges

Create explicit lineage edges in the graph connecting data producers to consumers:

```
Tool: mcp__mcp-graph__edge (from: "<producer-node-id>", to: "<consumer-node-id>", type: "related_to", metadata: { lineage: "data_flow", data_asset: "<asset-name>", transformation: "<description>" })
```

Lineage edge types:
| Edge Meaning | From | To | Example |
|-------------|------|-----|---------|
| Source to Extract | Source asset | Extract task | PRD file -> import_prd task |
| Extract to Transform | Extract task | Transform task | Raw parse -> normalize task |
| Transform to Load | Transform task | Load task | Enriched data -> store write |
| Load to Consume | Load task | Consumer task | Knowledge store -> RAG query |

### Step 4: Detect Lineage Gaps

Identify data assets with incomplete lineage (no documented producer or consumer):

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
Tool: mcp__mcp-graph__search (query: "orphan OR untracked OR unknown source")
```

Gap categories:
- **Sourceless data:** Data in the store with no documented origin (how did it get there?)
- **Dead-end data:** Data produced but never consumed downstream (is it needed?)
- **Undocumented transforms:** Tasks that modify data without explicit input/output documentation
- **Cross-phase gaps:** Data that crosses lifecycle phases (IMPLEMENT to VALIDATE) without lineage edges

### Step 5: Visualize Lineage

Generate a visual lineage map using the graph export:

```
Tool: mcp__mcp-graph__export (format: "mermaid", filter: "lineage")
```

The Mermaid diagram should show:
- Data assets as nodes (color-coded by type: source=green, intermediate=blue, target=orange)
- Lineage edges as directed arrows with transformation labels
- Phase boundaries as subgraph clusters
- Gap indicators as dashed red lines for missing lineage

### Step 6: Impact Analysis

For any given data asset, trace upstream and downstream impact:

**Upstream (root cause):** Follow lineage edges backward to find all source data and transformations that contribute to a given asset:

```
Tool: mcp__mcp-graph__search (query: "produces:<asset-name> OR outputs:<asset-name>")
```

**Downstream (blast radius):** Follow lineage edges forward to find all consumers affected by a change to a given asset:

```
Tool: mcp__mcp-graph__search (query: "consumes:<asset-name> OR inputs:<asset-name>")
```

### Step 7: Validate Lineage Completeness

Verify the lineage graph is complete and accurate:

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Completeness checks:
- Every data asset has at least one lineage edge (producer or consumer)
- No lineage cycles (data cannot be its own ancestor)
- All transformations are documented with input/output schema
- Cross-phase data handoffs have explicit lineage edges
- Knowledge store entries reference their source data

### Step 8: Export and Persist

Save the lineage map and analysis to memory:

```
Tool: mcp__mcp-graph__export (format: "mermaid")
Tool: mcp__mcp-graph__write_memory (title: "Data Lineage Map — <date>", content: <lineage-report>)
```

## Output Format

```
Phase: DATA LINEAGE TRACKING
Data Assets: <N> total (Source: <N>, Intermediate: <N>, Target: <N>, Reference: <N>)
Lineage Edges: <N> documented flows
Gaps Detected: <N> (Sourceless: <N>, Dead-end: <N>, Undocumented: <N>, Cross-phase: <N>)
Coverage: <N>% of assets have complete lineage
Longest Chain: <source> → ... → <target> (<N> hops)
Impact Analysis: <asset-name> affects <N> downstream consumers
Lineage Visualization: Mermaid diagram exported
Recommendations:
  1. <gap remediation>
  2. <lineage improvement>
  3. <documentation action>

Saved to memory: "Data Lineage Map — <date>"
```

## Anti-Patterns

- Do NOT assume lineage from code structure alone — explicit lineage edges are required for auditability
- Do NOT skip dead-end analysis — data produced but never consumed wastes compute and storage
- Do NOT create lineage edges without transformation metadata — "data flows from A to B" is insufficient without the "how"
- Do NOT ignore cross-phase lineage — data handoffs between lifecycle phases are the most common gap
- Do NOT treat lineage as a one-time activity — update lineage edges whenever data flows change
- Do NOT conflate task dependencies with data lineage — `depends_on` edges represent execution order, lineage edges represent data flow
- Do NOT skip impact analysis before modifying shared data structures — always trace downstream consumers first
