---
name: graph-observability-pipeline-orchestrator
description: Observability pipeline orchestration that unifies metrics, logs, traces, and events into a coherent data flow with routing, transformation, and storage optimization
triggers:
  - graph-observability-pipeline-orchestrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-observability-pipeline-orchestrator

Orchestrates the full observability data pipeline from collection through routing, transformation, enrichment, and storage. Unifies metrics, logs, traces, and events into a coherent data flow with intelligent routing, sampling strategies, and cost-optimized storage tiering. Ensures no observability data is lost, duplicated, or stored inefficiently.

## When to Use

- When designing or refactoring an observability pipeline from scratch
- When observability costs are growing and storage optimization is needed
- When multiple telemetry sources need unified routing and transformation rules
- When adding new services that must integrate into the existing observability stack
- When migrating between observability backends (e.g., Elastic to Grafana stack)
- When pipeline backpressure or data loss is occurring during load spikes

## Mandatory Flow

```
inventory(data sources) --> design(pipeline topology) --> configure(collectors + processors) --> route(signal routing rules) --> transform(enrichment + normalization) --> store(tiered storage) --> validate(data integrity) --> node(pipeline tasks) --> analyze(pipeline health) --> write_memory
```

## Workflow

### Step 1: Data Source Inventory

Catalog all telemetry data sources, their signal types, volumes, and current collection methods.

```
Tool: mcp__mcp-graph__analyze (mode: "design_ready")
```

```
Tool: mcp__mcp-graph__metrics (scope: "pipeline", action: "inventory")
```

Source catalog:

| Source Type | Signal | Volume | Collection Method |
|-------------|--------|--------|-------------------|
| Application services | Metrics + Logs + Traces | High | OTel SDK, sidecar |
| Infrastructure | Metrics + Logs | Medium | Agent (node_exporter, Filebeat) |
| Kubernetes | Metrics + Events + Logs | High | kube-state-metrics, Fluent Bit |
| Databases | Metrics + Slow query logs | Medium | Exporter, log tailing |
| Load balancers | Metrics + Access logs | High | Cloud integration, log shipping |
| CDN / Edge | Metrics + Logs | Very High | Vendor API, log push |
| CI/CD | Events + Metrics | Low | Webhook, API polling |
| Custom business events | Events | Variable | SDK instrumentation |

Record per-source: format, protocol, expected throughput (events/sec), retention requirements.

### Step 2: Pipeline Topology Design

Design the pipeline topology -- how data flows from sources through processing stages to storage backends.

Pipeline stages:

```
Sources --> Collectors --> Processors --> Routers --> Exporters --> Storage
```

Topology patterns:

| Pattern | When to Use | Trade-off |
|---------|-------------|-----------|
| Agent-per-node | VMs, bare-metal | High reliability, higher resource cost |
| Sidecar-per-pod | Kubernetes | Per-pod isolation, resource overhead per pod |
| Gateway (centralized) | Shared infrastructure | Efficient, single point of failure |
| Fan-out | Multiple backends | Redundancy, increased network and storage cost |
| Pipeline chain | Complex transformations | Flexibility, increased latency |

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Pipeline Topology Design — <environment>")
```

### Step 3: Collector Configuration

Configure data collectors at each source according to the pipeline topology.

Collector selection per signal:

| Signal | Collector Options | Recommended |
|--------|-------------------|-------------|
| Metrics | OTel Collector, Prometheus, Telegraf | OTel Collector (unified) |
| Logs | Fluent Bit, Fluentd, Vector, Filebeat | Fluent Bit (lightweight) or Vector (transforms) |
| Traces | OTel Collector, Jaeger Agent | OTel Collector (standard) |
| Events | OTel Collector, custom webhook receiver | OTel Collector or Vector |

Collector health metrics to monitor:
- Ingestion rate (events/sec)
- Drop rate (events/sec rejected or lost)
- Queue depth and backpressure signals
- Memory and CPU usage of the collector process

### Step 4: Signal Routing Rules

Define routing rules that direct each signal to the appropriate processing pipeline and storage backend.

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Routing dimensions:

| Dimension | Example Rules |
|-----------|---------------|
| Signal type | Metrics to Prometheus, Logs to Loki, Traces to Tempo |
| Environment | Production to high-retention, staging to low-retention |
| Severity | Error logs to hot storage, debug logs to cold storage |
| Service tier | Tier-1 services to all backends, Tier-3 to sampled storage |
| Cost | High-volume low-value data to sampled or aggregated pipeline |

Sampling strategies for high-volume signals:
- **Head sampling** -- decide at ingestion whether to keep (fast, stateless)
- **Tail sampling** -- decide after seeing the full trace (accurate, requires buffering)
- **Adaptive sampling** -- adjust sampling rate based on error rate and throughput
- **Priority sampling** -- always keep errors and slow traces, sample normal traces

### Step 5: Transformation and Enrichment

Transform and enrich telemetry data as it flows through the pipeline.

Transformation operations:

| Operation | Purpose | Example |
|-----------|---------|---------|
| Normalization | Consistent field names across sources | `host` / `hostname` / `server` all become `host.name` |
| Enrichment | Add context not in the original event | Add `environment`, `team`, `service.tier` from service catalog |
| Filtering | Remove noise before storage | Drop health check logs, debug-level logs from non-error requests |
| Aggregation | Reduce cardinality | Pre-aggregate per-request metrics into per-minute summaries |
| Redaction | Remove sensitive data | Strip PII, tokens, passwords from log messages |
| Parsing | Extract structured data | Parse unstructured log lines into structured fields |

```
Tool: mcp__mcp-graph__metrics (scope: "pipeline", action: "transform_stats")
```

### Step 6: Storage Tiering and Retention

Configure storage backends with appropriate retention policies and tiering for cost optimization.

Storage tiers:

| Tier | Retention | Use Case | Cost |
|------|-----------|----------|------|
| Hot | 1-7 days | Active investigation, real-time dashboards | Highest |
| Warm | 7-30 days | Recent incident review, trend analysis | Medium |
| Cold | 30-365 days | Compliance, long-term trend analysis | Low |
| Archive | 1-7 years | Regulatory compliance, audit | Lowest |

Per-signal storage:

| Signal | Hot | Warm | Cold |
|--------|-----|------|------|
| Metrics | 7 days (full resolution) | 30 days (5m aggregated) | 365 days (1h aggregated) |
| Logs | 3 days (full) | 14 days (sampled) | 90 days (aggregated counts) |
| Traces | 3 days (full) | 14 days (sampled, errors only full) | 30 days (aggregated service maps) |
| Events | 7 days (full) | 30 days (full) | 365 days (full) |

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Storage Tiering Configuration")
```

### Step 7: Data Integrity Validation

Validate that the pipeline delivers data completely and correctly from source to storage.

```
Tool: mcp__mcp-graph__analyze (mode: "validate_ready")
```

Validation checks:
- **Completeness** -- compare source emission rate vs storage ingestion rate (delta = data loss)
- **Latency** -- measure end-to-end pipeline latency (source timestamp to storage availability)
- **Correctness** -- spot-check that transformations produce expected output for known input
- **Deduplication** -- verify no duplicate events in storage from retry or fan-out logic
- **Ordering** -- confirm that time-series data arrives in order (or is reordered by storage)

### Step 8: Record Pipeline Configuration

Save the pipeline design, configuration decisions, and validation results.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Observability Pipeline Design — <environment> <date>"
  content: "<source inventory, pipeline topology, routing rules, sampling strategy, transformation rules, storage tiering, validation results, cost estimates>"
  tags: ["observability", "pipeline", "aiops", "telemetry"]
```

## Output Format

```
Phase: OBSERVABILITY PIPELINE ORCHESTRATION
Environment: <environment name>

Sources:
  Total: <N> data sources
  Signals: metrics (<N>), logs (<N>), traces (<N>), events (<N>)
  Total throughput: <N> events/sec

Pipeline:
  Topology: <pattern>
  Collectors: <N> configured
  Routing rules: <N>
  Transformations: <N>

Sampling:
  Strategy: <head/tail/adaptive>
  Rate: <N>% (estimated cost savings: <N>%)

Storage:
  Hot: <N> days, <N> GB estimated
  Warm: <N> days, <N> GB estimated
  Cold: <N> days, <N> GB estimated
  Estimated monthly cost: $<N>

Validation:
  Data loss rate: <N>%
  Pipeline latency: <N>ms (P95)
  Deduplication: <pass/fail>

Saved to memory: "Observability Pipeline Design — <env> <date>"
```

## Anti-Patterns

- Do NOT send all data to a single storage backend -- tiered storage with appropriate retention dramatically reduces cost
- Do NOT skip sampling for high-volume signals -- tail sampling can reduce trace storage by 90% while keeping all error traces
- Do NOT apply transformations after storage -- enrich and normalize in the pipeline to avoid expensive post-hoc queries
- Do NOT ignore backpressure signals from collectors -- dropped data during load spikes creates blind spots in exactly the moments you need visibility most
- Do NOT hardcode routing rules -- use label-based routing so new services automatically flow through the correct pipeline
- Do NOT forget to monitor the pipeline itself -- an observability pipeline without self-monitoring is a single point of failure for all observability
- Do NOT mix retention requirements in a single storage tier -- regulatory data needs separate retention policies from operational data
