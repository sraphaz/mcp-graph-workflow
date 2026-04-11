---
name: graph-iot-sensor-stream-processor
description: Real-time sensor stream processing with sliding windows, aggregation, and filtering
triggers:
  - graph-iot-sensor-stream-processor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-stream-processor

Orchestrates real-time processing of continuous sensor data streams using sliding window operations, temporal aggregation, and rule-based filtering. Transforms raw high-frequency telemetry into actionable time-series summaries suitable for downstream analytics, alerting, and storage.

## When to Use

- When raw sensor data arrives at high frequency and must be aggregated before storage
- When implementing sliding window computations (moving average, percentile, standard deviation)
- When applying real-time filters to discard noise or irrelevant readings
- When downsampling sensor streams for long-term retention without losing statistical fidelity
- When computing session-based or tumbling window aggregates for batch analytics

## Mandatory Flow

```
search(existing stream nodes) → node(add stream processing task) → analyze(tdd_check) → implement processors with TDD → metrics(throughput) → write_memory(window strategies) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Audit Existing Stream Processing Infrastructure

Search the execution graph for previously defined stream processors, aggregation nodes, or related window logic to identify reusable components.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Review existing pipeline stages and their throughput characteristics

### Step 2: Define Stream Processing Task Nodes

Create task nodes for each processing stage: ingestion buffer, window computation, filter application, and output sink.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: latency SLA, window accuracy, memory bounds, backpressure compliance

### Step 3: Implement Sliding Window Engine

Build the core sliding window engine supporting multiple window types:

- **Tumbling windows:** Fixed-size, non-overlapping time intervals (e.g., 1-minute averages)
- **Sliding windows:** Overlapping intervals with configurable slide step (e.g., 5-min window, 1-min slide)
- **Session windows:** Gap-based windows that close after inactivity timeout
- **Count windows:** Fixed number of events regardless of time

Each window computes configurable aggregates: min, max, mean, median, p95, p99, stddev, count, sum.

### Step 4: Implement Filter Pipeline

Build a composable filter chain that processes each record before window ingestion:

- **Range filter:** Drop readings outside physically plausible bounds (e.g., temperature -40 to 85C)
- **Rate-of-change filter:** Flag or discard readings with impossible rate of change
- **Duplicate filter:** Deduplicate retransmitted messages using sensorId + timestamp
- **Quality filter:** Discard readings with low signal quality (RSSI, battery, error flags)

### Step 5: Implement Downsampling Strategy

For long-term storage, implement multi-resolution downsampling:

| Resolution | Retention | Aggregates |
|-----------|-----------|------------|
| Raw (1s) | 24 hours | All fields |
| 1-minute | 7 days | min, max, mean, count |
| 15-minute | 30 days | min, max, mean, p95 |
| 1-hour | 1 year | min, max, mean, stddev |

### Step 6: Measure Processing Metrics

Capture and report stream processing performance metrics to verify SLA compliance.

**Tool:** `mcp__mcp-graph__metrics`
- Track: events/second throughput, window computation latency, memory usage per window, filter drop rate
- Compare against defined SLAs

### Step 7: Validate Stream Integrity

Run integration tests that feed synthetic streams through the pipeline and verify window outputs match expected aggregates within tolerance.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify all acceptance criteria including latency SLA and memory bounds

### Step 8: Persist Processing Decisions

Record window sizing rationale, filter thresholds, and downsampling strategy in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: window strategies, filter chain configuration, downsampling policy

## Output Format

```yaml
stream_processing_report:
  windows:
    - type: sliding
      size: "5m"
      slide: "1m"
      aggregates: [mean, p95, stddev]
      sensors_covered: 48
    - type: tumbling
      size: "1m"
      aggregates: [min, max, mean, count]
      sensors_covered: 48
  filters:
    range_filter:
      readings_dropped: 1204
      drop_rate: "0.03%"
    duplicate_filter:
      duplicates_removed: 87
    quality_filter:
      low_quality_dropped: 342
  downsampling:
    raw_retention: "24h"
    resolutions: ["1m", "15m", "1h"]
  performance:
    throughput_events_per_sec: 25000
    avg_window_latency_ms: 1.8
    peak_memory_mb: 256
    backpressure_events: 0
```

## Anti-Patterns

- Do NOT compute aggregates on unbounded windows; always define maximum window size and eviction policy
- Do NOT apply filters after window computation; filter early to reduce processing load
- Do NOT use wall-clock time for windowing; use event-time from sensor timestamps to handle out-of-order data
- Do NOT store all raw data indefinitely; implement downsampling with defined retention policies
- Do NOT ignore late-arriving data; implement watermark-based late event handling
- Do NOT allocate per-event objects in the hot path; use pre-allocated ring buffers
- Do NOT skip backpressure testing; verify pipeline behavior at 2x expected peak load
