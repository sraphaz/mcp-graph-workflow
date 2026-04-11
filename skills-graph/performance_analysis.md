---
name: performance_analysis
description: Quantitative performance analysis using Amdahl's Law, Little's Law, DORA metrics, GraphRAG benchmarks, and MAPE-K optimization loop
triggers:
  - performance_analysis
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# performance_analysis

Quantitative performance analysis using mathematical models (Amdahl's Law, Gustafson's Law, Little's Law), DORA delivery metrics, GraphRAG pipeline benchmarks (traversal latency, hybrid search recall/precision, density analysis), and AIOps MAPE-K loop for continuous optimization. Focuses on scientific measurement and theoretical speedup calculation, generating actionable optimization tasks in the execution graph.

Complements `/graph-performance` (practical audit: Lighthouse, Web Vitals, N+1, memory profiling) with a scientific/mathematical layer. Run `/graph-performance` first for baseline data, then `performance_analysis` for quantitative modeling and optimization planning.

## When to Use

- After VALIDATE phase — when quantitative optimization evidence is needed before deploy
- Before major scaling decisions — calculate theoretical speedup limits (Amdahl/Gustafson)
- When RAG pipeline latency degrades — benchmark graph traversal and hybrid search quality
- When parallelization opportunities arise — compute speedup ceilings before investing effort
- During LISTENING phase — compare DORA baselines against SOTA benchmarks and plan next cycle
- After adding significant data to knowledge store — re-benchmark GraphRAG performance

## Mandatory Flow

```
collect baselines --> Amdahl/Gustafson analysis --> Little's Law flow metrics --> GraphRAG benchmarks --> DORA comparison --> MAPE-K loop --> optimization task nodes --> report --> write_memory
```

## Workflow

### Step 1: Collect Performance Baselines

Gather current metrics from the graph and RAG pipeline:

```
Tool: mcp__mcp-graph__metrics (mode: "stats")
Tool: mcp__mcp-graph__metrics (mode: "velocity")
Tool: mcp__mcp-graph__forecast (mode: "dora")
Tool: mcp__mcp-graph__knowledge_stats
```

Record the following baseline table:

| Metric | Value | Unit | Source |
|--------|-------|------|--------|
| Task throughput | — | tasks/day | `metrics(velocity)` |
| WIP count | — | tasks | `metrics(stats)` — in_progress count |
| Avg cycle time | — | hours | `forecast(dora)` — lead time |
| RAG query latency (P50) | — | ms | `rag_context` trace |
| RAG query latency (P95) | — | ms | `rag_context` trace |
| Knowledge entries | — | count | `knowledge_stats` |
| Cache hit ratio | — | % | `knowledge_stats` |
| FTS5 search latency | — | ms | benchmark measurement |
| Graph node count | — | count | `metrics(stats)` |
| Graph edge density | — | edges/(nodes*(nodes-1)) | computed |

If no previous baseline exists in memory, this run establishes the first baseline. Check memory first:

```
Tool: mcp__mcp-graph__search (query: "Performance Analysis baseline")
```

### Step 2: Amdahl's Law Analysis (Parallelization Ceiling)

Identify serial vs parallelizable portions of the critical pipeline paths.

**Formula:**
```
Speedup(n) = 1 / (S + (1 - S) / n)
```
Where `S` = serial fraction (0-1), `n` = number of parallel workers.

**Apply to RAG pipeline** (`src/core/rag/multi-strategy-retrieval.ts`):
- The RAG pipeline has 4 weighted strategies (FTS5/BM25, graph traversal, recency, quality) that execute sequentially but could be parallelized
- Serial portions: query understanding, RRF merge, post-retrieval processing, citation mapping
- Parallelizable portions: the 4 strategy executions themselves

**Apply to graph traversal** (`src/core/graph/`):
- SQLite FTS5 + BM25 queries are inherently serial (single-threaded SQLite)
- Knowledge linker graph walks can parallelize across independent subgraphs

**Apply to task pipeline:**
- Serial: status validation, dependency checks, AC verification
- Parallelizable: test execution, build, lint (independent CI steps)

Produce the analysis table:

| Component | Serial Fraction (S) | Max Speedup (n=inf) | Speedup (n=4) | Speedup (n=8) | Speedup (n=16) |
|-----------|---------------------|---------------------|---------------|---------------|----------------|
| RAG pipeline | — | 1/S | — | — | — |
| Graph traversal | — | 1/S | — | — | — |
| Task pipeline | — | 1/S | — | — | — |
| **Overall** | — | 1/S | — | — | — |

**Target:** Identify the component with the lowest serial fraction — this is where parallelization effort yields the highest return.

### Step 3: Gustafson's Law Analysis (Scaled Speedup)

For workloads that grow with data (knowledge base expansion, graph node count increase), Gustafson's Law provides a more realistic speedup model.

**Formula:**
```
Speedup(n) = n - S * (n - 1)
```
Where `S` = serial fraction, `n` = parallel workers.

**Apply to scaling scenarios:**

| Scenario | Corpus Size | Serial Fraction | Speedup (n=4) | Speedup (n=8) |
|----------|-------------|-----------------|---------------|---------------|
| Current knowledge base | current count | — | — | — |
| 10x knowledge growth | 10x current | — | — | — |
| 100x knowledge growth | 100x current | — | — | — |

**Key insight:** Amdahl's Law is pessimistic for growing workloads. If the parallelizable portion grows faster than the serial portion (e.g., more knowledge entries to index, but startup cost stays constant), Gustafson predicts better real-world speedup.

Apply to:
- Batch reindexing (`reindex_knowledge`) — corpus size grows, indexing overhead per entry is parallelizable
- Bulk node import (`import_prd`) — more nodes to create, but graph validation stays serial
- Sprint planning decomposition — more tasks to plan, but dependency resolution stays serial

### Step 4: Little's Law — Pipeline Flow Analysis

The mcp-graph workflow enforces WIP=1 per agent. Verify this with Little's Law.

**Formula:**
```
L = lambda * W
```
Where `L` = average WIP (items in system), `lambda` = arrival rate (throughput), `W` = average cycle time.

**Measure from graph data:**

| Metric | Symbol | Value | Source |
|--------|--------|-------|--------|
| Average WIP | L | — | count of `in_progress` tasks |
| Throughput | lambda | — | tasks completed per day (`forecast(dora)`) |
| Avg cycle time | W | — | avg `done_timestamp - in_progress_timestamp` |

**Validation:** Does `L` equal `lambda * W`? Calculate deviation:

```
Deviation = |L_measured - (lambda * W)| / L_measured * 100
```

- Deviation < 10%: system is in steady state — Little's Law holds
- Deviation 10-30%: transient effects — check for batch arrivals or context switches
- Deviation > 30%: systemic flow problem — queue buildup, starvation, or blocked tasks accumulating

**M/M/1 Queuing Model** (single-server queue):

| Metric | Formula | Value |
|--------|---------|-------|
| Arrival rate | lambda | — tasks/hour |
| Service rate | mu | — tasks/hour |
| Utilization | rho = lambda / mu | — |
| Avg queue length | L_q = rho^2 / (1 - rho) | — |
| Avg wait time | W_q = rho / (mu * (1 - rho)) | — hours |

**Critical threshold:** If `rho > 0.8`, the system is at capacity risk — small arrival rate increases cause exponential queue growth. Recommend reducing WIP or increasing service rate.

### Step 5: GraphRAG Benchmark Suite

This is the core differentiator from `/graph-performance`. Benchmark the RAG pipeline end-to-end.

**5a. Traversal Latency**

Measure each RAG strategy individually and combined:

```
Tool: mcp__mcp-graph__rag_context (query: <benchmark query>, mode: "deep")
```

| Strategy | P50 (ms) | P95 (ms) | P99 (ms) | Weight |
|----------|----------|----------|----------|--------|
| FTS5/BM25 | — | — | — | 0.35 |
| Graph traversal | — | — | — | 0.30 |
| Recency | — | — | — | 0.20 |
| Quality | — | — | — | 0.15 |
| **RRF merge** | — | — | — | — |
| **Total pipeline** | — | — | — | — |

**5b. Hybrid Search Quality**

Test with known-relevant query sets (use existing knowledge entries as ground truth):

| Metric | BM25 Only | Graph Only | Hybrid (RRF) | Target |
|--------|-----------|------------|--------------|--------|
| Precision@5 | — | — | — | > 0.70 |
| Recall@10 | — | — | — | > 0.80 |
| F1 | — | — | — | > 0.75 |
| MRR | — | — | — | > 0.60 |

**5c. Graph Density Analysis**

```
Edge density = |edges| / (|nodes| * (|nodes| - 1))
Knowledge relation density = |knowledge_links| / |knowledge_entries|
```

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Edge density | — | < 0.1 sparse, 0.1-0.3 moderate, > 0.3 dense |
| Knowledge relation density | — | < 1.0 underlinked, 1.0-3.0 healthy, > 3.0 heavily linked |
| Avg shortest path | — | Lower = better traversal performance |

**5d. Cache Effectiveness**

| Cache Layer | Hit Rate | Miss Penalty (ms) | Eviction Rate |
|-------------|----------|-------------------|---------------|
| Semantic cache (`src/core/rag/semantic-cache.ts`) | — | — | — |
| Query cache (`src/core/rag/query-cache.ts`) | — | — | — |
| Response cache (`src/core/rag/response-cache.ts`) | — | — | — |

**5e. SOTA Comparison**

Compare against published benchmarks (2025-2026):

| System | Metric | Published Baseline | Our Value | Gap |
|--------|--------|--------------------|-----------|-----|
| vLLM | Token throughput (tok/s) | 2000-5000 | — | — |
| SGLang | Batched inference latency (ms) | 50-200 | — | — |
| LangGraph | Graph traversal P95 (ms) | 100-500 | — | — |
| Auto-GPT Swarm | Task throughput (tasks/min) | 5-15 | — | — |
| GraphRAG (Microsoft) | Retrieval F1 | 0.65-0.80 | — | — |

Note: SOTA baselines must be adjusted for hardware and corpus size. Flag comparisons where hardware differs significantly.

### Step 6: DORA Metrics Deep Analysis

Go beyond the simple DORA check in `/graph-performance` with trend analysis and tier prediction.

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

**DORA Tier Classification (2025-2026 benchmarks):**

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| Deployment Frequency | > 1/day | 1/day-1/week | 1/week-1/month | < 1/month |
| Lead Time for Changes | < 1 hour | < 1 day | < 1 week | > 1 month |
| Change Failure Rate | < 5% | < 10% | < 15% | > 15% |
| Time to Restore (MTTR) | < 1 hour | < 1 day | < 1 week | > 1 month |

**Trend Analysis:**

| Metric | Current | 7-day Avg | 30-day Avg | Trend | Current Tier | Target Tier |
|--------|---------|-----------|------------|-------|--------------|-------------|
| Deploy Frequency | — | — | — | up/down/stable | — | — |
| Lead Time | — | — | — | up/down/stable | — | — |
| Change Failure Rate | — | — | — | up/down/stable | — | — |
| MTTR | — | — | — | up/down/stable | — | — |

**Cross-correlation:** Verify inverse relationship between deployment frequency and change failure rate. If both increase together, the pipeline has a quality problem — fast but broken.

**Tier prediction:** At current trajectory (linear regression on 30-day data), estimate when each metric reaches the next DORA tier.

### Step 7: MAPE-K Optimization Loop

Apply the MAPE-K (Monitor-Analyze-Plan-Execute-Knowledge) loop from autonomic computing to create actionable optimization tasks.

**7a. Monitor** — Metrics collected in Steps 1-6.

**7b. Analyze** — Identify bottlenecks using Pareto analysis:
- Rank all measured latencies/inefficiencies by impact
- Apply 80/20 rule: which 20% of components cause 80% of total latency?
- Cross-reference with Amdahl analysis: which bottlenecks have the highest theoretical speedup?

**7c. Plan** — For each top-3 bottleneck, define an optimization:

| Rank | Bottleneck | Current | Target | Approach | Estimated Speedup | Effort |
|------|-----------|---------|--------|----------|-------------------|--------|
| 1 | — | — | — | — | — | S/M/L |
| 2 | — | — | — | — | — | S/M/L |
| 3 | — | — | — | — | — | S/M/L |

**7d. Execute** — Create optimization task nodes in the graph:

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Optimize: <bottleneck>", description: "<approach + expected speedup>", priority: "high")
Tool: mcp__mcp-graph__edge (from: <new_task_id>, to: <related_node>, relation: "optimizes")
```

Every task node MUST include the quantified expected speedup in its description. No task without a number.

**7e. Knowledge** — Save the full analysis for future MAPE-K iterations:

```
Tool: mcp__mcp-graph__write_memory (title: "Performance Analysis — <date>", content: <full report>, tags: ["performance", "amdahl", "littles-law", "dora", "graphrag", "mape-k"])
```

### Step 8: Quantitative Performance Report

Compile the final report with numeric values, theoretical ceilings, and gap analysis.

**Performance Score** (0-100) computed per dimension:

| Dimension | Weight | Score | Baseline | Current | Theoretical Max | Gap to Max |
|-----------|--------|-------|----------|---------|-----------------|------------|
| RAG Latency | 25% | — | — | — | Amdahl ceiling | — |
| Search Quality | 20% | — | — | — | F1=1.0 | — |
| Pipeline Flow | 20% | — | — | — | Little's Law optimal | — |
| DORA Delivery | 20% | — | — | — | Elite tier | — |
| Cache Efficiency | 15% | — | — | — | 100% hit rate | — |
| **Overall** | 100% | — | — | — | — | — |

Save final report:

```
Tool: mcp__mcp-graph__write_memory (title: "Performance Analysis — <date>", content: <report>)
```

## Output Format

```
Phase: QUANTITATIVE PERFORMANCE ANALYSIS
Date: <date>

Amdahl Ceiling: <N>x max speedup (serial fraction: <N>%)
  - RAG pipeline: <N>x (S=<N>%)
  - Graph traversal: <N>x (S=<N>%)
  - Task pipeline: <N>x (S=<N>%)
Gustafson Scaled: <N>x at <N> workers for <N>K corpus

Little's Law: WIP=<N>, throughput=<N>/day, cycle_time=<N>h (deviation: <N>%)
  - Utilization (rho): <N> — <ok/at capacity/overloaded>
  - Avg queue length: <N> tasks

GraphRAG Latency: P50=<N>ms, P95=<N>ms, P99=<N>ms
  - FTS5/BM25: <N>ms | Graph Traversal: <N>ms | RRF Merge: <N>ms
Hybrid Search: Precision=<N>%, Recall=<N>%, F1=<N>%
Cache Hit Rates: Semantic=<N>%, Query=<N>%, Response=<N>%

DORA: Freq=<N>/day (<tier>), LeadTime=<N>h (<tier>), CFR=<N>% (<tier>), MTTR=<N>h (<tier>)
DORA Trend: <improving/stable/degrading>

MAPE-K Actions: <N> optimization tasks created
  1. <task title> — expected speedup <N>x
  2. <task title> — expected speedup <N>x
  3. <task title> — expected speedup <N>x

SOTA Gap: <N>% vs vLLM throughput, <N>% vs LangGraph traversal, <N>% vs GraphRAG F1

Overall Score: <N>/100
  - RAG Latency: <N>/100
  - Search Quality: <N>/100
  - Pipeline Flow: <N>/100
  - DORA Delivery: <N>/100
  - Cache Efficiency: <N>/100

Saved to memory: "Performance Analysis — <date>"
```

## Anti-Patterns

- Do NOT confuse this skill with `/graph-performance` — this skill is for quantitative/scientific analysis, not practical audit checklists
- Do NOT apply Amdahl's Law without measuring the actual serial fraction — profiling first, math second
- Do NOT benchmark without warmup — cold-start numbers skew cache effectiveness metrics
- Do NOT compare against SOTA baselines without controlling for hardware and corpus size
- Do NOT create optimization tasks without quantified impact estimates — every task node must include expected speedup
- Do NOT ignore Little's Law violations — if WIP diverges significantly from lambda * W, there is a systemic flow problem
- Do NOT skip the MAPE-K feedback loop — analysis without action items is waste
