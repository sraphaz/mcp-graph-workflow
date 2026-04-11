---
name: graph-nlp-entity-extractor
description: Extract entities (files, functions, requirements, risks) from code and documentation using NLP and code intelligence
triggers:
  - graph-nlp-entity-extractor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-entity-extractor

Extracts structured entities from code, documentation, PRDs, and task descriptions. Combines NLP-based extraction with code intelligence analysis to produce a comprehensive entity inventory. Entities are typed, scored for confidence, and linked to their source locations for traceability.

## When to Use

- When importing a new PRD and need to extract all referenced files, functions, modules, and requirements
- When analyzing code comments and docstrings for implicit requirements or design decisions
- When building a project glossary or domain model from existing documentation
- When detecting undocumented dependencies between code modules and task descriptions
- When preparing for impact analysis and need a comprehensive entity map
- When auditing graph completeness by comparing extracted entities against existing nodes

## Mandatory Flow

```
search → code_intelligence → [NLP entity extraction] → analyze → write_memory
```

## Workflow

### Step 1: Identify Extraction Scope

Define the scope of entity extraction -- specific files, directories, PRDs, or entire graph content.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<scope description>", limit: 30 })
```

Locate all relevant nodes and documents within the target scope.

### Step 2: Code Intelligence Analysis

Use code intelligence to extract symbol-level entities from source code.

**Tool:** `mcp__mcp-graph__code_intelligence`

```
code_intelligence({ action: "analyze", path: "<target-path>" })
```

This provides AST-level entities:
- Function declarations and signatures
- Class definitions and method inventories
- Import/export relationships
- Interface definitions and type aliases

### Step 3: NLP Entity Extraction from Text

Process unstructured text (PRDs, task descriptions, comments) to extract entities that code intelligence cannot detect:

**Technical Entities:**
- File paths and directory references (e.g., `src/core/store/`)
- Configuration keys and environment variables
- API endpoint patterns (e.g., `/api/v1/nodes`)
- Database table and column references

**Domain Entities:**
- Feature names and capability references
- User roles and personas
- Business rules and constraints
- Acceptance criteria items

**Process Entities:**
- Workflow steps and phase references
- Tool names and MCP tool references
- Integration points and external service names

**Risk Entities:**
- Uncertainty markers ("might", "could", "unclear", "TBD")
- Complexity indicators ("complex", "challenging", "tricky")
- Dependency flags ("depends on", "blocked by", "requires")

### Step 4: Entity Deduplication and Merging

Merge entities from code intelligence and NLP extraction:

- Match entities by normalized name (case-insensitive, alias-aware)
- Prefer code intelligence data for technical entities (higher precision)
- Prefer NLP data for domain and risk entities (broader recall)
- Assign a merged confidence score based on source agreement

### Step 5: Entity Classification and Scoring

Classify each entity along multiple dimensions:

- **Type**: technical, domain, process, risk
- **Subtype**: function, class, file, requirement, constraint, risk
- **Confidence**: 0.0 to 1.0 based on extraction method and context
- **Importance**: derived from frequency, centrality, and dependency count
- **Staleness**: estimated from last modification date of source

### Step 6: Graph Gap Analysis

Compare the extracted entity inventory against existing graph nodes.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

Identify:
- **Untracked entities**: entities found in text/code but missing from the graph
- **Phantom nodes**: graph nodes referencing entities that no longer exist in code
- **Misaligned entities**: graph nodes whose descriptions don't match current code state

### Step 7: Persist Entity Inventory

Store the complete entity inventory in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "entity-inventory",
  category: "nlp-entity-extraction",
  content: "<structured entity inventory JSON>"
})
```

## Output Format

```json
{
  "extraction_id": "nlp-ee-<timestamp>",
  "scope": {
    "type": "prd | codebase | directory | node-set",
    "paths": ["src/core/store/", "docs/prd-v2.md"],
    "nodeCount": 15
  },
  "entities": [
    {
      "name": "SqliteStore",
      "type": "technical",
      "subtype": "class",
      "source": "code_intelligence",
      "confidence": 0.98,
      "importance": 0.85,
      "locations": [
        { "file": "src/core/store/sqlite-store.ts", "line": 42 }
      ],
      "linkedNodeId": "node-store-impl"
    }
  ],
  "gaps": {
    "untracked": ["ConfigLoader", "event-bus.ts"],
    "phantom": [],
    "misaligned": ["node-api-router"]
  },
  "statistics": {
    "totalEntities": 87,
    "byType": { "technical": 52, "domain": 20, "process": 8, "risk": 7 },
    "avgConfidence": 0.82,
    "gapCount": 3
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT extract entities from code without running code intelligence first -- NLP alone misses symbol-level precision
- Do NOT treat all entities as equal importance -- score and rank them to focus downstream effort
- Do NOT skip deduplication -- duplicate entities from multiple sources inflate the inventory and confuse analysis
- Do NOT extract entities without linking them to graph nodes -- unlinked entities provide no actionable value
- Do NOT ignore low-confidence entities -- flag them for review rather than discarding silently
- Do NOT run extraction on the entire codebase every time -- scope the extraction to changed or relevant areas
- Do NOT persist raw extraction results without classification -- always produce typed, scored entities
