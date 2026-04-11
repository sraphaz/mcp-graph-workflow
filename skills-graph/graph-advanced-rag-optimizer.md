---
name: graph-advanced-rag-optimizer
description: Continuous Hybrid Search + GraphRAG optimization — tunes BM25 parameters, reranking thresholds, and late-chunking strategies via feedback loop
triggers:
  - graph-advanced-rag-optimizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-advanced-rag-optimizer

Continuously optimizes the RAG pipeline by tuning BM25 parameters, adjusting reranking thresholds, refining chunking strategies, and closing the feedback loop between retrieval quality and task outcomes. Operates autonomously to keep knowledge retrieval precision high as the graph grows.

## When to Use

- After a significant batch of new knowledge has been indexed (>50 new entries)
- When `rag_context` retrieval quality drops — agents report irrelevant or missing context
- When `knowledge_stats` shows index staleness or fragmentation
- Proactively after every sprint completion to recalibrate retrieval parameters
- When adding new document types or knowledge sources to the pipeline
- Autonomously when retrieval latency exceeds acceptable thresholds (>2s per query)

## Mandatory Flow

```
knowledge_stats → benchmark_retrieval → tune_bm25 → tune_reranking → tune_chunking → validate_improvements → write_memory
```

## Workflow

### Step 1: Assess Current RAG Health

Gather baseline metrics on the knowledge store:
```
Tool: mcp__mcp-graph__knowledge_stats
```

Key metrics to capture:
- Total documents indexed, by category
- Average chunk size and distribution
- FTS5 index size and fragmentation
- Last reindex timestamp
- Query cache hit rate

### Step 2: Benchmark Current Retrieval Quality

Run a battery of test queries against the RAG pipeline:
```
Tool: mcp__mcp-graph__rag_context (query: "<benchmark_query_1>")
Tool: mcp__mcp-graph__rag_context (query: "<benchmark_query_2>")
Tool: mcp__mcp-graph__rag_context (query: "<benchmark_query_3>")
```

Score each result set on:

| Metric | Description | Target |
|--------|-------------|--------|
| Precision@5 | Relevant results in top 5 | > 0.80 |
| Recall@10 | Total relevant captured in top 10 | > 0.70 |
| MRR | Mean Reciprocal Rank of first relevant | > 0.75 |
| Latency | Query-to-results time | < 500ms |
| Freshness | Age of returned documents | < 7 days avg |

### Step 3: Tune BM25 Parameters

Analyze term frequency distributions to optimize BM25 k1 and b parameters:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Recommended tuning ranges:
- **k1** (term saturation): 1.2-2.0 — increase for longer documents, decrease for short chunks
- **b** (length normalization): 0.5-0.85 — decrease if chunk sizes are uniform, increase if varied
- **avgdl** recalculation: trigger when average document length shifts >20%

### Step 4: Tune Reranking Thresholds

Adjust the post-retrieval reranking pipeline:
```
Tool: mcp__mcp-graph__rag_context (query: "reranking threshold calibration test")
```

Calibration parameters:

| Parameter | Current | Adjustment Rule |
|-----------|---------|----------------|
| Score cutoff | 0.3 | Lower if recall too low, raise if precision too low |
| Max results | 10 | Increase for broad queries, decrease for precise |
| Diversity penalty | 0.1 | Increase if results are too homogeneous |
| Recency boost | 1.2x | Increase for fast-moving projects |
| Source weight | 1.0x | Boost authoritative sources (ADRs, decisions) |

### Step 5: Tune Chunking Strategy

Evaluate and optimize the chunking approach:
```
Tool: mcp__mcp-graph__knowledge_stats
```

Chunking optimization strategies:
- **Late chunking**: Preserve full document context, chunk at retrieval time
- **Semantic chunking**: Split at topic boundaries rather than fixed token counts
- **Hierarchical chunking**: Parent chunks (512 tokens) with child chunks (128 tokens)
- **Overlap tuning**: Adjust chunk overlap from 10-25% based on query boundary hits

### Step 6: Validate Improvements

Re-run the benchmark queries from Step 2 with updated parameters:
```
Tool: mcp__mcp-graph__rag_context (query: "<benchmark_query_1>")
```

Compare against baselines:
- Precision improvement > 5% = accept changes
- Precision degradation > 3% = rollback to previous parameters
- Latency increase > 100ms = investigate and optimize

Record results:
```
Tool: mcp__mcp-graph__metrics
```

### Step 7: Persist Optimization Results

Save tuning results and parameter snapshots:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "RAG optimization cycle: BM25 k1=<val> b=<val>, rerank cutoff=<val>, chunk size=<val>. Precision@5 improved from <old> to <new>."
  tags: ["rag-optimization", "bm25-tuning", "retrieval-quality"]
```

### Step 8: Self-Healing Monitoring

Set up continuous monitoring triggers:
- If query cache hit rate drops below 40%, trigger reindex
- If average retrieval latency exceeds 1s, investigate index fragmentation
- If new knowledge category is added, rerun chunking optimization for that category
- After every 100 new documents indexed, trigger a mini-benchmark

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

## Output Format

```
RAG Optimizer Report
====================
Knowledge Store:
  Total Documents: <N>
  Categories: <list>
  Index Age: <days> since last full reindex

Retrieval Benchmarks:
  Precision@5:  <before> → <after> (<delta>%)
  Recall@10:    <before> → <after> (<delta>%)
  MRR:          <before> → <after> (<delta>%)
  Latency:      <before>ms → <after>ms (<delta>ms)

Parameters Updated:
  BM25 k1: <old> → <new>
  BM25 b:  <old> → <new>
  Rerank cutoff: <old> → <new>
  Chunk size: <old> → <new>

Status: <improved/degraded/stable>
Next Optimization: after <N> new documents or <N> days
```

## Anti-Patterns

- Do NOT tune parameters without first establishing a benchmark baseline — blind tuning is guesswork
- Do NOT change multiple parameters simultaneously — isolate each variable for clear attribution
- Do NOT skip the validation step — always compare before/after with the same benchmark queries
- Do NOT ignore retrieval latency — precision gains that double latency are not acceptable
- Do NOT reindex the entire knowledge store unnecessarily — use incremental indexing when possible
- Do NOT forget to persist parameter snapshots via `write_memory` — rollback requires history
- Do NOT apply aggressive recency bias unless the project context genuinely demands it
