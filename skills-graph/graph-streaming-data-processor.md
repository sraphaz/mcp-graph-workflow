---
name: graph-streaming-data-processor
description: Real-time streaming data processing integrated with the graph pipeline for event-driven workflows and continuous ingestion
triggers:
  - graph-streaming-data-processor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-streaming-data-processor

Integrates real-time streaming data processing into the execution graph pipeline, enabling event-driven workflows, continuous ingestion, windowed aggregations, and backpressure-aware consumption. Processes data records as they arrive rather than in batch, with graph nodes tracking stream state, offsets, and processing guarantees.

## When to Use

- When data arrives continuously and must be processed without waiting for batch completion
- During IMPLEMENT for features that react to real-time events (file watchers, webhook handlers)
- When the GraphEventBus emits events that need continuous processing and aggregation
- After configuring integrations that produce streaming data (Playwright captures, code analysis)
- When metrics must be computed as rolling windows rather than point-in-time snapshots
- During VALIDATE for continuous assertion checking against a live data stream

## Mandatory Flow

```
define stream source → configure consumer → set processing windows → create stream nodes → process with backpressure → compute windowed metrics → checkpoint state → report → write_memory
```

## Workflow

### Step 1: Define Stream Source

Identify and configure the streaming data source:

```
Tool: mcp__mcp-graph__search (query: "event OR stream OR watch OR webhook OR real-time OR continuous")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Stream source types:
| Source | Pattern | Event Type |
|--------|---------|------------|
| GraphEventBus | Pub/sub events | Node status changes, edge additions |
| File watcher | Filesystem events | File created, modified, deleted |
| Webhook handler | HTTP push events | External service notifications |
| Log tailer | Continuous file read | New log entries appended |
| SQLite triggers | Database events | Row inserts, updates, deletes |
| Polling adapter | Periodic pull → stream | API responses converted to events |

For each source, define:
- Event schema (fields, types, required vs. optional)
- Expected throughput (events/second)
- Ordering guarantees (ordered, unordered, partially ordered)
- Delivery semantics (at-most-once, at-least-once, exactly-once)

### Step 2: Configure Stream Consumer

Set up the consumer with appropriate processing guarantees:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Stream Consumer — <source>", type: "task", priority: "high", metadata: { stream_config: { source: "<source>", delivery: "at-least-once", max_batch: 100, flush_interval_ms: 5000 } })
```

Consumer configuration:
| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_batch` | 100 | Max events processed per micro-batch |
| `flush_interval_ms` | 5000 | Max time before flushing partial batch |
| `max_in_flight` | 10 | Concurrent processing slots |
| `retry_max` | 3 | Retries per failed event |
| `dead_letter` | true | Route failed events to dead letter queue |
| `dedup_window_ms` | 60000 | Deduplication window for at-least-once |

### Step 3: Set Processing Windows

Define time-based and count-based windows for aggregation:

| Window Type | Description | Use Case |
|------------|-------------|----------|
| **Tumbling** | Fixed-size, non-overlapping intervals | 5-minute metric snapshots |
| **Sliding** | Fixed-size, overlapping intervals | Rolling 1-hour average |
| **Session** | Gap-based, variable length | Group events by activity burst |
| **Count** | Fixed number of events | Every 100 events, compute summary |
| **Global** | All events since start | Running totals and cumulative stats |

```
Tool: mcp__mcp-graph__node (action: "add", name: "Window Config — <type>", type: "task", metadata: { window: { type: "tumbling", size_ms: 300000, watermark_ms: 10000 } })
```

Watermark strategy:
- Set watermark lag to handle out-of-order events (default: 10s)
- Events arriving after watermark are routed to late-arrival handler
- Late arrivals update the previous window result if reprocessing is enabled

### Step 4: Create Stream Processing Nodes

Model the streaming pipeline as graph nodes:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Stream: <source> → Filter", type: "task", metadata: { stage: "filter", stream: true })
Tool: mcp__mcp-graph__node (action: "add", name: "Stream: Filter → Enrich", type: "task", metadata: { stage: "enrich", stream: true })
Tool: mcp__mcp-graph__node (action: "add", name: "Stream: Enrich → Aggregate", type: "task", metadata: { stage: "aggregate", stream: true })
Tool: mcp__mcp-graph__node (action: "add", name: "Stream: Aggregate → Sink", type: "task", metadata: { stage: "sink", stream: true })
```

Wire stream processing edges:

```
Tool: mcp__mcp-graph__edge (from: "<filter-id>", to: "<enrich-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<enrich-id>", to: "<aggregate-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<aggregate-id>", to: "<sink-id>", type: "depends_on")
```

### Step 5: Process with Backpressure

Implement backpressure-aware processing to prevent overload:

```
Tool: mcp__mcp-graph__metrics ()
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Backpressure strategies:
| Pressure Level | Consumer Lag | Action |
|---------------|-------------|--------|
| **Normal** | <100 events | Process at full speed |
| **Elevated** | 100-1000 events | Increase batch size, reduce enrichment |
| **High** | 1000-10000 events | Skip optional transforms, sample instead of full process |
| **Critical** | >10000 events | Drop low-priority events, alert, scale consumers |

Backpressure signals:
- Consumer lag (events queued but not yet processed)
- Processing latency (time per event increasing)
- Memory usage (approaching configured limit)
- Error rate (failures increasing under load)

### Step 6: Compute Windowed Metrics

Calculate real-time metrics within each processing window:

```
Tool: mcp__mcp-graph__metrics ()
```

Per-window metrics:
- **Throughput:** Events processed per window
- **Latency:** P50, P95, P99 processing time per event
- **Error rate:** Failed events / total events
- **Backpressure events:** Times backpressure was applied
- **Window completeness:** Events processed vs. expected
- **Late arrivals:** Events arriving after window watermark

Rolling aggregations:
- 1-minute rolling average throughput
- 5-minute rolling error rate
- 1-hour cumulative event count
- Session-based activity detection (events per active session)

### Step 7: Checkpoint Stream State

Persist stream processing state for recovery and resumption:

```
Tool: mcp__mcp-graph__node (action: "update", id: "<consumer-node-id>", metadata: { checkpoint: { offset: <N>, timestamp: "<ISO>", window_state: { pending: <N>, completed: <N> } } })
```

Checkpoint contents:
- **Offset:** Last successfully processed event position
- **Window state:** In-progress window aggregations (for recovery)
- **Dead letter count:** Events routed to dead letter since last checkpoint
- **Consumer lag:** Current backlog size at checkpoint time

Checkpoint frequency: Every 30 seconds or every 1000 events (whichever comes first).

Recovery procedure on restart:
1. Load last checkpoint from node metadata
2. Resume processing from saved offset
3. Recompute any incomplete windows
4. Verify no duplicate processing (dedup window check)

### Step 8: Report and Persist

Save the streaming processing report:

```
Tool: mcp__mcp-graph__write_memory (title: "Stream Processing Report — <source> — <date>", content: <report>)
```

## Output Format

```
Phase: STREAMING DATA PROCESSING
Stream: <source-name>
Duration: <start> → <end> (<total-time>)
Events:
  - Received: <N>
  - Processed: <N> (<N>/sec avg throughput)
  - Failed: <N> (error rate: <N>%)
  - Late arrivals: <N>
  - Dead lettered: <N>
Windows: <N> completed (<type>, <size>)
Latency: P50=<N>ms, P95=<N>ms, P99=<N>ms
Backpressure: <N> events (peak level: <normal|elevated|high|critical>)
Checkpoints: <N> saved, last at <timestamp> (offset: <N>)
Consumer Lag: <N> events (trend: stable|increasing|decreasing)
Status: RUNNING | PAUSED | COMPLETED | ERROR

Saved to memory: "Stream Processing Report — <source> — <date>"
```

## Anti-Patterns

- Do NOT process streaming data without backpressure handling — unbounded consumption leads to OOM and cascading failures
- Do NOT skip checkpointing — without checkpoints, a crash means reprocessing the entire stream from the beginning
- Do NOT use global windows for high-volume streams — they grow unbounded; use tumbling or sliding windows instead
- Do NOT ignore late arrivals — decide explicitly whether to drop, reprocess, or route to a late-arrival handler
- Do NOT mix batch and stream semantics — a stream processor must handle events individually, not wait for a complete dataset
- Do NOT set watermark too aggressively — too-tight watermarks cause excessive late arrivals; too-loose watermarks delay results
- Do NOT process without deduplication for at-least-once delivery — duplicate events corrupt aggregation results
