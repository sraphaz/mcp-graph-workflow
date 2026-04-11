---
name: graph-nlp-rag-enhancer
description: Enhance Hybrid Search with NLP techniques including query expansion, semantic reranking, and coreference resolution
triggers:
  - graph-nlp-rag-enhancer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-rag-enhancer

Enhances the existing RAG (Retrieval-Augmented Generation) pipeline with advanced NLP techniques. Applies query expansion, semantic reranking, coreference resolution, and query reformulation to improve retrieval precision and recall. Monitors retrieval quality metrics and persists optimization insights for continuous pipeline improvement.

## When to Use

- When RAG queries return irrelevant or low-quality results that miss the user's intent
- When the knowledge store has grown large and simple keyword matching produces too many false positives
- When queries use different terminology than the indexed content (vocabulary mismatch)
- When queries contain pronouns or references that need resolution before retrieval (coreference)
- When retrieval recall is low and relevant documents are being missed by the current pipeline
- When preparing for a knowledge audit and need to benchmark retrieval quality

## Mandatory Flow

```
rag_context → knowledge_stats → [NLP enhancement pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Baseline Retrieval Assessment

Run the original query through the existing RAG pipeline to establish a baseline.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ query: "<original-query>", includeKnowledge: true })
```

**Tool:** `mcp__mcp-graph__knowledge_stats`

```
knowledge_stats({})
```

Record:
- Number of results returned
- Top-k relevance scores
- Result diversity (how many distinct topics are covered)
- Knowledge store size and index health

### Step 2: Query Understanding and Classification

Analyze the query to determine enhancement strategy:

**Query Types:**
- **Keyword query**: "sqlite store migrations" -- needs synonym expansion
- **Natural language query**: "how does the store handle schema changes?" -- needs term extraction
- **Referential query**: "what does it do when a node is blocked?" -- needs coreference resolution
- **Compound query**: "compare FTS5 performance with and without BM25 scoring" -- needs decomposition
- **Negation query**: "tasks that are NOT in the current sprint" -- needs special handling

**Query Complexity:**
- Simple (1 concept, 1-3 terms)
- Moderate (2-3 concepts, 3-7 terms)
- Complex (4+ concepts, requires decomposition)

### Step 3: Query Expansion

Expand the query to improve recall without sacrificing precision:

**Synonym Expansion:**
- Map domain-specific synonyms (e.g., "store" -> "database", "sqlite", "persistence")
- Map code-specific aliases (e.g., "event bus" -> "GraphEventBus", "event-bus.ts")
- Map abbreviations and acronyms (e.g., "PRD" -> "product requirements document")

**Hypernym/Hyponym Expansion:**
- Broaden: "SqliteStore" -> "data persistence layer"
- Narrow: "search" -> "FTS5 search", "BM25 search", "TF-IDF search"

**Contextual Expansion:**
- Add terms from the current sprint context
- Add terms from recently accessed knowledge entries
- Add terms from the user's recent query history

### Step 4: Coreference Resolution

Resolve pronouns and referential expressions in queries:

- "it" -> resolve to the most recently discussed entity
- "the module" -> resolve to the specific module in context
- "this feature" -> resolve to the feature currently being worked on
- "the same approach" -> resolve to the previously mentioned approach

Use the current graph context (active task, sprint, phase) to ground resolution.

### Step 5: Query Decomposition

For complex queries, decompose into sub-queries:

- Identify distinct information needs within the compound query
- Generate focused sub-queries for each need
- Plan a merge strategy for combining sub-query results

Example:
- Original: "How does the RAG pipeline handle large documents and what are its performance limits?"
- Sub-query 1: "RAG pipeline large document handling chunking"
- Sub-query 2: "RAG pipeline performance limits benchmarks"

### Step 6: Enhanced Retrieval

Run the expanded/decomposed queries through the RAG pipeline.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ query: "<expanded-query>", includeKnowledge: true })
```

Collect results from all query variants and sub-queries.

### Step 7: Semantic Reranking

Rerank the combined result set using semantic criteria:

**Reranking Signals:**
- **Query-document semantic similarity**: deep similarity beyond keyword overlap
- **Information density**: prefer documents with more relevant information per token
- **Recency**: prefer newer documents for temporal queries
- **Authority**: prefer knowledge store entries over raw task descriptions
- **Diversity**: ensure top-k results cover different aspects of the query
- **Coverage**: penalize documents that only partially address the query

**Reranking Algorithm:**
```
final_score = (semantic_sim * 0.35) + (bm25_score * 0.25) + (info_density * 0.15) + (recency * 0.10) + (authority * 0.10) + (diversity_bonus * 0.05)
```

### Step 8: Quality Metrics

Compute retrieval quality metrics comparing baseline to enhanced results:

- **Precision@k**: fraction of top-k results that are relevant
- **Recall improvement**: how many relevant documents were recovered by expansion
- **Mean Reciprocal Rank (MRR)**: position of the first relevant result
- **Diversity score**: topic coverage across top-k results
- **Expansion efficiency**: how many expansion terms contributed to finding new relevant results

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

### Step 9: Persist Enhancement Results

Store the enhancement configuration and quality metrics.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "rag-enhancement",
  category: "nlp-rag-enhancer",
  content: "<enhancement config + quality metrics JSON>"
})
```

## Output Format

```json
{
  "enhancement_id": "nlp-re-<timestamp>",
  "originalQuery": "how does the store handle migrations?",
  "enhancedQueries": [
    "sqlite store schema migration backward compatible",
    "SqliteStore migrations/ database upgrade",
    "store handle migrations data integrity"
  ],
  "coreferences": [
    { "pronoun": "the store", "resolved": "SqliteStore (src/core/store/sqlite-store.ts)" }
  ],
  "baseline": {
    "resultCount": 3,
    "topRelevance": 0.62,
    "mrr": 0.50
  },
  "enhanced": {
    "resultCount": 8,
    "topRelevance": 0.91,
    "mrr": 1.0,
    "precisionAt5": 0.80,
    "recallImprovement": "+166%"
  },
  "rerankedResults": [
    { "id": "knowledge-migration-001", "score": 0.91, "source": "knowledge_store" },
    { "id": "node-sqlite-migrations", "score": 0.85, "source": "graph_node" }
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT expand queries blindly with too many synonyms -- over-expansion reduces precision and floods results with noise
- Do NOT skip baseline measurement -- without a baseline, you cannot evaluate whether enhancements actually improved quality
- Do NOT ignore coreference resolution -- pronouns in queries cause major retrieval failures
- Do NOT rerank without semantic signals -- reranking by BM25 score alone just reproduces the original ranking
- Do NOT decompose simple queries -- decomposition overhead is only justified for genuinely compound queries
- Do NOT persist enhancement configs without quality metrics -- optimization without measurement is guesswork
- Do NOT apply the same expansion strategy to all query types -- keyword queries need synonym expansion while natural language queries need term extraction
