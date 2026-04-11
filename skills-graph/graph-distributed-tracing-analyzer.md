---
name: graph-distributed-tracing-analyzer
description: Advanced distributed tracing analysis with OpenTelemetry and Jaeger correlation, latency breakdown, and dependency mapping across graph services
triggers:
  - graph-distributed-tracing-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-distributed-tracing-analyzer

Advanced distributed tracing analysis with automatic correlation of spans across graph services. Breaks down latency by component, maps service dependencies, and identifies slow paths using OpenTelemetry-compatible trace data.

## When to Use

- When API or MCP tool response times exceed SLO thresholds
- When diagnosing cross-module latency in the graph pipeline
- Proactively after each DEPLOY phase to baseline trace performance
- When `mcp__mcp-graph__metrics` shows degraded throughput
- When investigating intermittent slowness that metrics alone cannot explain
- As part of the observability stack alongside `graph-aiops-root-cause-analyzer`

## Mandatory Flow

```
collect traces → parse spans → build dependency graph → identify critical path → latency breakdown → anomaly flagging → report → write_memory
```

## Workflow

### Step 1: Collect Trace Data

Gather distributed traces from the graph execution pipeline:

```
Tool: mcp__mcp-graph__metrics
Params: type: "trace", window: "24h"
```

Identify trace sources:

| Source | Traces | Format |
|--------|--------|--------|
| MCP tool invocations | Tool call → response spans | OpenTelemetry |
| RAG pipeline | Query → retrieval → reranking spans | Internal |
| SQLite operations | Query → write → commit spans | Internal |
| API endpoints | Request → handler → response spans | OpenTelemetry |

### Step 2: Parse and Correlate Spans

Build a span tree from raw trace data:

1. Group spans by `traceId`
2. Order by `startTime` within each trace
3. Compute `selfTime = duration - sum(childDurations)` for each span
4. Flag spans where `selfTime > 80% of duration` (leaf bottleneck)

### Step 3: Build Service Dependency Graph

Map caller-callee relationships across all traces:

```
Tool: mcp__mcp-graph__analyze
Params: mode: "progress"
```

Generate adjacency list: `serviceA → serviceB (avg latency, call count, error rate)`.

Identify:
- **Fan-out hotspots**: services calling >5 downstream services
- **Single points of failure**: services on every critical path
- **Circular dependencies**: A → B → C → A patterns

### Step 4: Identify Critical Path

For each trace, compute the critical path (longest sequential chain):

1. Walk the span tree depth-first
2. At each fork, follow the child with the longest duration
3. Sum latencies along the critical path
4. Compare critical path latency to total trace duration

Flag traces where `critical_path / total_duration > 0.9` — these have no parallelism benefit.

### Step 5: Latency Breakdown

Generate per-service and per-operation latency statistics:

| Service | P50 | P95 | P99 | Max | Error Rate |
|---------|-----|-----|-----|-----|------------|
| RAG pipeline | 120ms | 340ms | 890ms | 2.1s | 0.3% |
| SQLite store | 5ms | 18ms | 45ms | 120ms | 0.0% |
| MCP tools | 80ms | 250ms | 600ms | 1.8s | 1.2% |

Identify operations exceeding SLO thresholds and rank by impact (frequency x latency).

### Step 6: Anomaly Flagging

Detect trace anomalies:

- **Latency spikes**: P99 > 3x rolling average
- **Missing spans**: Expected child spans not present
- **Excessive retries**: Same operation appears >2x in a trace
- **Timeout cascades**: Parent timeout causing child cancellations

```
Tool: mcp__mcp-graph__node
Params: action: "add", type: "task", title: "Investigate trace anomaly: <description>", priority: "high"
```

### Step 7: Generate Report and Save

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Distributed Tracing Analysis — <date>"
  content: "<dependency graph, critical paths, latency breakdown, anomalies, recommendations>"
  tags: ["tracing", "observability", "latency", "distributed-systems"]
```

## Output Format

```
Phase: DISTRIBUTED TRACING ANALYSIS
Traces Analyzed: N (window: 24h)
Services Mapped: N
Critical Path Avg: Nms (P95: Nms)
Anomalies Detected: N (N critical, N warning)
Top Bottleneck: <service> — <operation> (P95: Nms)
Dependency Hotspots: N fan-out, N single-point-of-failure
Recommendations: N actions created
Overall Trace Health: A-F

Saved to memory: "Distributed Tracing Analysis — <date>"
```

## Anti-Patterns

- Do NOT analyze traces without sufficient sample size — minimum 100 traces per window
- Do NOT alert on single slow traces — use percentile thresholds (P95/P99)
- Do NOT ignore missing spans — they indicate instrumentation gaps
- Do NOT flatten the span tree — preserve parent-child relationships for root cause analysis
- Do NOT measure only total latency — self-time per span reveals true bottlenecks
- Do NOT skip dependency graph generation — it reveals architectural issues invisible in metrics
