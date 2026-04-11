---
name: graph-nlp-named-entity-linking
description: Link extracted entities to graph nodes, mapping function names in PRDs to corresponding task nodes and code symbols
triggers:
  - graph-nlp-named-entity-linking
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-named-entity-linking

Links named entities extracted from PRDs, documentation, and code comments to their corresponding graph nodes, code symbols, and knowledge entries. Resolves ambiguous references (e.g., "the store" to `SqliteStore` or `KnowledgeStore`), builds a unified entity-to-node mapping, and detects orphaned references that point to nonexistent targets. Enables traceability from natural language to executable graph structure.

## When to Use

- When a PRD mentions function names, modules, or features that need to be mapped to existing graph nodes
- When code comments reference task IDs, feature names, or requirements that should be linked to the graph
- When detecting broken references in documentation that point to renamed or deleted entities
- When building a traceability matrix from requirements to implementation nodes
- When resolving ambiguous entity mentions (e.g., "the parser" could be `classify.ts`, `extract.ts`, or the entire `parser/` module)
- When onboarding and need to understand which code symbols correspond to which graph nodes

## Mandatory Flow

```
search → code_intelligence → [entity linking pipeline] → analyze → write_memory → node
```

## Workflow

### Step 1: Extract Named Entities

Identify all named entities in the source text that could be linked to graph nodes or code symbols.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<source text or document topic>", limit: 30 })
```

Entity types to extract:
- **Code symbols**: function names, class names, file paths, module references
- **Graph references**: task names, epic names, node IDs, sprint identifiers
- **Domain terms**: feature names, capability names, component names
- **External references**: library names, API names, service names

### Step 2: Candidate Generation

For each extracted entity, generate a list of candidate targets from the graph and code index.

**Tool:** `mcp__mcp-graph__code_intelligence`

```
code_intelligence({ action: "search", query: "<entity-name>" })
```

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<entity-name>", limit: 10 })
```

For each entity, produce candidates from:
- **Graph nodes**: nodes whose name or description contains the entity text
- **Code symbols**: functions, classes, or files matching the entity name
- **Knowledge entries**: knowledge store entries referencing the entity

### Step 3: Disambiguation and Ranking

When multiple candidates exist for an entity, disambiguate using context:

**Disambiguation Signals:**
- **Textual context**: surrounding sentences provide clues (e.g., "the store that handles migrations" points to `SqliteStore`, not `KnowledgeStore`)
- **Type compatibility**: if the entity is used as a function, prefer function candidates over class candidates
- **Proximity**: prefer candidates in the same module or epic as the source text
- **Recency**: prefer recently modified candidates over stale ones
- **Frequency**: prefer candidates that appear more often in related contexts

**Scoring Formula:**
```
link_score = (textual_similarity * 0.4) + (type_match * 0.2) + (proximity * 0.2) + (recency * 0.1) + (frequency * 0.1)
```

Select the top candidate if score > 0.6. Flag as ambiguous if top two candidates are within 0.1 of each other.

### Step 4: Link Validation

Validate each proposed link against the graph and code state.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

Validation checks:
- **Target exists**: the linked node/symbol actually exists in the current graph/codebase
- **Target is active**: the linked node is not archived, deleted, or deprecated
- **Type consistency**: the link type matches (e.g., a requirement entity links to a requirement node, not a task node)
- **Bidirectional coherence**: the target node's description references or is consistent with the source entity

### Step 5: Orphan Detection

Identify entities that cannot be linked to any target:

- **Dangling references**: entity mentions a specific name but no matching node or symbol exists
- **Stale references**: entity links to a node that has been renamed or deleted
- **Forward references**: entity describes something planned but not yet created in the graph

For each orphan, classify the resolution action:
- Create a new node (if the entity represents untracked work)
- Update the reference (if the target was renamed)
- Flag for review (if the reference is ambiguous or outdated)

### Step 6: Build Entity Link Map

Produce a comprehensive mapping from entities to their linked targets.

Include:
- Entity text, type, and source location
- Linked target (node ID, symbol name, or knowledge entry ID)
- Link confidence score
- Disambiguation notes (if multiple candidates were considered)

### Step 7: Create Missing Nodes

For orphaned entities that represent untracked work, create corresponding graph nodes.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "<entity-name>", type: "task", description: "<derived from context>" })
```

Only create nodes for entities that clearly represent actionable work items. Flag ambiguous cases for human review.

### Step 8: Persist Link Map

Store the entity link map in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "entity-link-map",
  category: "nlp-entity-linking",
  content: "<structured link map JSON>"
})
```

## Output Format

```json
{
  "linking_id": "nlp-el-<timestamp>",
  "source": {
    "type": "prd | code-comments | documentation",
    "document": "docs/prd-v2.md",
    "entityCount": 34
  },
  "links": [
    {
      "entity": { "text": "GraphEventBus", "type": "code_symbol", "location": { "line": 45 } },
      "target": { "type": "node", "id": "node-event-bus-impl", "name": "Implement GraphEventBus" },
      "score": 0.94,
      "disambiguation": "unique match"
    },
    {
      "entity": { "text": "the store", "type": "domain_term", "location": { "line": 78 } },
      "target": { "type": "symbol", "name": "SqliteStore", "file": "src/core/store/sqlite-store.ts" },
      "score": 0.72,
      "disambiguation": "resolved via context: 'the store that handles migrations'"
    }
  ],
  "orphans": [
    {
      "entity": { "text": "CacheManager", "type": "code_symbol" },
      "reason": "no matching node or symbol found",
      "resolution": "create_node",
      "created": true,
      "newNodeId": "node-cache-manager"
    }
  ],
  "statistics": {
    "totalEntities": 34,
    "linked": 28,
    "orphaned": 4,
    "ambiguous": 2,
    "avgConfidence": 0.81
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT link entities without consulting code intelligence -- text-only matching produces false positives on common terms
- Do NOT auto-create nodes for every orphaned entity -- only create nodes for clearly actionable work items
- Do NOT ignore ambiguous links -- flag them explicitly for human resolution rather than guessing
- Do NOT skip link validation -- linking to deleted or renamed targets propagates stale references
- Do NOT perform linking without context -- isolated entity names are inherently ambiguous
- Do NOT treat entity linking as a one-time operation -- re-run when PRDs are updated or code is refactored
- Do NOT link across incompatible types -- a requirement entity should not link to a code symbol without an intermediate task node
