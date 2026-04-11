---
name: interdisciplinary-knowledge-intersector
description: Discover cross-domain intersections in knowledge store to generate novel skill ideas and research directions
triggers:
  - interdisciplinary-knowledge-intersector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# interdisciplinary-knowledge-intersector

Discover **cross-domain intersections** between knowledge documents from different source types. Analyzes tag overlap, entity co-occurrence, and TF-IDF keyword similarity to surface novel connections and suggest new skills.

## When to Use

- Knowledge store has documents from multiple source types (prd, docs, memory, skill, etc.)
- You want to discover unexpected connections between domains
- Looking for novel skill ideas based on existing knowledge
- The `_lifecycle.phase` is `ANALYZE`, `DESIGN`, or `LISTENING`
- After indexing new knowledge from external sources

## Mandatory Flow

```
reindex_knowledge → intersect_knowledge(discover) → [review insights] → write_memory → [create new skill if promising]
```

## Workflow

### Step 1: Ensure Knowledge is Indexed

Before discovering intersections, make sure the knowledge store is populated:
```
Tool: mcp__mcp-graph__reindex_knowledge
```

Check knowledge stats to see source type distribution:
```
Tool: mcp__mcp-graph__knowledge_stats
```

### Step 2: Discover Intersections

Run the intersection discovery engine:
```
Tool: mcp__mcp-graph__intersect_knowledge
Params: { action: "discover" }
```

Filter by concept for targeted discovery:
```
Tool: mcp__mcp-graph__intersect_knowledge
Params: { action: "discover", concept: "quantum", minScore: 0.1 }
```

### Step 3: Review Results

List previously generated intersections:
```
Tool: mcp__mcp-graph__intersect_knowledge
Params: { action: "list", limit: 10 }
```

Get full details of a specific intersection:
```
Tool: mcp__mcp-graph__intersect_knowledge
Params: { action: "detail", docId: "<intersection-doc-id>" }
```

### Step 4: Save Promising Patterns

Save promising intersections as memories for future reference:
```
Tool: mcp__mcp-graph__memory
Params: { action: "write", title: "Intersection: <domainA> x <domainB>", content: "<insights and next steps>" }
```

### Step 5: Create New Skills (Optional)

If an intersection suggests a viable new skill:
```
Tool: mcp__mcp-graph__manage_skill
Params: { action: "create", data: { name: "<suggested-skill-name>", description: "<description>", category: "know-me", phases: ["ANALYZE", "DESIGN"], instructions: "<based on intersection insights>" } }
```

## Scoring

The intersector computes a combined score from three signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Tag overlap | 0.35 | Jaccard similarity of metadata tags between source type groups |
| Entity overlap | 0.35 | Jaccard similarity of extracted entities (types, tools, patterns) |
| Keyword similarity | 0.30 | TF-IDF based vocabulary overlap |

**Default threshold:** 0.15 (adjustable via `minScore` parameter)

## Anti-Patterns

- Running discovery on an empty or single-source-type knowledge store (no intersections possible)
- Setting minScore too high (> 0.5) — most genuine cross-domain intersections have moderate scores
- Ignoring low-score intersections — sometimes the most novel connections have lower scores
- Not saving promising patterns via write_memory — insights are lost if not persisted

## Integration with Other Skills

- **graph-analyze**: Run intersector during ANALYZE phase to inform PRD creation
- **graph-design**: Use intersection insights to inform architectural decisions
- **graph-listening**: Discover new patterns from feedback and post-sprint knowledge
