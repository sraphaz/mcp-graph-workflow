---
name: graph-nlp-topic-modeling
description: Topic discovery and semantic clustering of tasks, PRDs, and knowledge entries in the execution graph
triggers:
  - graph-nlp-topic-modeling
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-topic-modeling

Discovers latent topics and performs semantic clustering across tasks, PRDs, knowledge entries, and documentation in the execution graph. Identifies thematic groupings, detects topic drift, and surfaces hidden connections between seemingly unrelated nodes. Enables better sprint organization, gap detection, and knowledge navigation.

## When to Use

- When the graph has grown large (50+ nodes) and needs thematic organization for easier navigation
- When planning sprints and need to group related tasks into coherent work streams
- When detecting knowledge gaps by finding topics with sparse coverage in the knowledge store
- When identifying cross-cutting concerns that span multiple epics or features
- When onboarding and need a topic map to understand the project's conceptual landscape
- When looking for redundant or overlapping tasks that describe the same topic differently

## Mandatory Flow

```
search → rag_context → [topic modeling pipeline] → analyze → knowledge_stats → write_memory
```

## Workflow

### Step 1: Collect Text Corpus

Gather all text content from the graph for topic modeling. This includes node names, descriptions, acceptance criteria, knowledge entries, and PRD content.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "*", limit: 200 })
```

Retrieve a broad set of nodes to build a comprehensive corpus. For large graphs, batch by epic or sprint.

### Step 2: Load Knowledge Context

Enrich the corpus with knowledge store entries for better topic resolution.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ query: "<broad project topic>", includeKnowledge: true })
```

Knowledge entries often contain terminology and context that improves topic coherence.

### Step 3: Text Preprocessing

Prepare the corpus for topic modeling:

- **Tokenization**: split text into meaningful tokens, respecting code identifiers (camelCase, kebab-case)
- **Stop word removal**: remove common English stop words plus project-specific noise words
- **Lemmatization**: reduce words to base forms while preserving technical terms
- **N-gram extraction**: capture multi-word phrases ("sprint planning", "knowledge store", "code intelligence")
- **TF-IDF weighting**: compute term importance across the corpus to surface discriminative terms

### Step 4: Topic Discovery

Apply topic modeling to identify latent themes:

**Cluster Formation:**
- Group documents by semantic similarity using embedding-based clustering
- Identify optimal number of topics (aim for 5-15 for most projects)
- Assign each document a probability distribution across topics

**Topic Labeling:**
- Extract top-10 representative terms per topic
- Generate a human-readable label from the top terms
- Identify the most representative document for each topic

**Topic Hierarchy:**
- Detect parent-child relationships between topics (e.g., "API" contains "REST routes" and "MCP tools")
- Build a topic tree for hierarchical navigation

### Step 5: Semantic Clustering of Graph Nodes

Map discovered topics back to graph nodes:

- Assign each node a primary topic and secondary topic(s)
- Compute topic coherence score (how well a node fits its assigned topic)
- Identify outlier nodes that don't fit any topic well (potential orphans or cross-cutting concerns)

### Step 6: Topic Gap and Drift Analysis

Analyze topic coverage and evolution.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

**Tool:** `mcp__mcp-graph__knowledge_stats`

```
knowledge_stats({})
```

Detect:
- **Topic gaps**: topics with many tasks but few knowledge entries (under-documented areas)
- **Topic drift**: topics whose composition has shifted over sprints (scope creep indicators)
- **Topic hotspots**: topics with high task density and active work (current focus areas)
- **Cold topics**: topics with no recent activity (potentially abandoned or deferred work)

### Step 7: Generate Topic Map

Produce a structured topic map suitable for visualization and navigation.

Include:
- Topic labels, descriptions, and representative terms
- Node-to-topic assignments with confidence scores
- Inter-topic relationships (similarity, hierarchy, dependency)
- Coverage statistics (tasks per topic, knowledge entries per topic)

### Step 8: Persist Topic Model

Store the topic model and clustering results.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "topic-model",
  category: "nlp-topic-modeling",
  content: "<structured topic model JSON>"
})
```

## Output Format

```json
{
  "model_id": "nlp-tm-<timestamp>",
  "corpus": {
    "documentCount": 156,
    "vocabularySize": 2340,
    "avgDocLength": 85
  },
  "topics": [
    {
      "id": "topic-01",
      "label": "RAG Pipeline & Knowledge Retrieval",
      "terms": ["rag", "embedding", "retrieval", "knowledge", "search", "bm25", "fts5", "index", "query", "context"],
      "nodeCount": 18,
      "knowledgeEntries": 12,
      "coherenceScore": 0.78,
      "representativeNode": "node-rag-pipeline-impl"
    }
  ],
  "hierarchy": {
    "root": ["topic-01", "topic-02", "topic-03"],
    "children": { "topic-01": ["topic-04", "topic-05"] }
  },
  "gaps": [
    { "topic": "topic-03", "issue": "12 tasks but only 1 knowledge entry" }
  ],
  "drift": [
    { "topic": "topic-02", "direction": "expanding", "newTerms": ["playwright", "e2e"] }
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT run topic modeling on fewer than 20 documents -- insufficient corpus produces meaningless topics
- Do NOT use raw text without preprocessing -- code identifiers and stop words dominate topics without cleaning
- Do NOT fix the number of topics without evaluating coherence -- let the data guide topic count
- Do NOT ignore outlier nodes -- they often represent cross-cutting concerns or misclassified tasks
- Do NOT skip the knowledge stats check -- topic gaps are only visible when comparing tasks to knowledge entries
- Do NOT treat topic assignments as permanent -- re-run modeling when the graph grows significantly (>20% new nodes)
- Do NOT present topics without human-readable labels -- raw term lists are not actionable
