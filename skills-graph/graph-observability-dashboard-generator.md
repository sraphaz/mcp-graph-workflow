---
name: graph-observability-dashboard-generator
description: Auto-generate Grafana-compatible observability dashboards from metrics, service topology, and SLO definitions with best-practice layout and alert integration
triggers:
  - graph-observability-dashboard-generator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-observability-dashboard-generator

Auto-generates observability dashboards compatible with Grafana JSON format from metrics inventory, service topology, and SLO definitions. Applies dashboard best practices (RED/USE methods, golden signals, consistent layout), generates panel queries, configures alert rules, and produces exportable dashboard JSON ready for import. Eliminates manual dashboard creation while ensuring consistency across teams.

## When to Use

- When new services are deployed and need observability dashboards from day one
- When standardizing dashboard layouts across multiple teams and services
- When migrating between monitoring platforms and need to regenerate dashboards
- When SLO definitions change and dashboards need to reflect new targets
- When auditing dashboard coverage to find services without adequate monitoring
- When preparing executive-level dashboards that aggregate service-level data

## Mandatory Flow

```
inventory(metrics + services) --> design(layout + panels) --> generate(Grafana JSON) --> configure(alerts + thresholds) --> export(dashboard files) --> validate(panel queries) --> metrics(coverage report) --> analyze(completeness) --> write_memory
```

## Workflow

### Step 1: Metrics and Service Inventory

Catalog all available metrics, their labels, and the services they belong to. This determines what dashboards can be generated.

```
Tool: mcp__mcp-graph__metrics (scope: "inventory")
```

```
Tool: mcp__mcp-graph__analyze (mode: "design_ready")
```

Metrics classification:

| Category | Examples | Dashboard Type |
|----------|----------|---------------|
| Request metrics | `http_requests_total`, `grpc_requests_total` | RED dashboard |
| Resource metrics | `cpu_usage`, `memory_usage`, `disk_io` | USE dashboard |
| Business metrics | `orders_created`, `payments_processed` | Business KPI dashboard |
| SLO metrics | `error_budget_remaining`, `availability` | SLO dashboard |
| Infrastructure metrics | `node_cpu`, `pod_restarts`, `container_memory` | Infrastructure dashboard |
| Pipeline metrics | `queue_depth`, `consumer_lag`, `processing_time` | Data pipeline dashboard |

Per metric record: name, type (counter, gauge, histogram, summary), labels, cardinality, and source service.

### Step 2: Dashboard Layout Design

Design the dashboard layout following observability best practices and consistent patterns.

Dashboard hierarchy:

```
Executive Overview
  +-- Service Overview (per service)
  |    +-- RED Dashboard (request-driven)
  |    +-- USE Dashboard (resource-driven)
  |    +-- SLO Dashboard
  |    +-- Custom Dashboard (service-specific)
  +-- Infrastructure Overview
       +-- Kubernetes Cluster
       +-- Database
       +-- Cache / Queue
```

Panel layout rules:
- **Row 1 (Golden Signals):** latency P50/P95/P99, error rate, traffic rate, saturation
- **Row 2 (RED details):** request rate by endpoint, error rate by type, latency heatmap
- **Row 3 (USE details):** CPU utilization, memory utilization, disk I/O, network I/O
- **Row 4 (Dependencies):** downstream call rate, downstream error rate, downstream latency
- **Row 5 (SLOs):** error budget burn rate, availability, SLO compliance

Standard time ranges: 1h (debugging), 6h (shift review), 24h (daily review), 7d (weekly trend).

### Step 3: Panel and Query Generation

Generate Grafana panel definitions with PromQL/LogQL queries for each panel.

```
Tool: mcp__mcp-graph__export (format: "json", scope: "dashboard_panels")
```

Panel generation per dashboard type:

**RED Dashboard panels:**

| Panel | Query Pattern | Visualization |
|-------|---------------|---------------|
| Request rate | `sum(rate(http_requests_total[5m])) by (service)` | Time series |
| Error rate | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` | Time series + threshold |
| Latency P50/P95/P99 | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` | Time series |
| Latency heatmap | `sum(rate(http_request_duration_seconds_bucket[5m])) by (le)` | Heatmap |
| Top endpoints | `topk(10, sum(rate(http_requests_total[5m])) by (endpoint))` | Table |

**USE Dashboard panels:**

| Panel | Query Pattern | Visualization |
|-------|---------------|---------------|
| CPU utilization | `avg(rate(container_cpu_usage_seconds_total[5m])) by (pod) / avg(kube_pod_container_resource_limits{resource="cpu"}) by (pod)` | Gauge + time series |
| Memory utilization | `avg(container_memory_usage_bytes) by (pod) / avg(kube_pod_container_resource_limits{resource="memory"}) by (pod)` | Gauge + time series |
| Disk I/O | `rate(container_fs_reads_bytes_total[5m]) + rate(container_fs_writes_bytes_total[5m])` | Time series |
| Network I/O | `rate(container_network_receive_bytes_total[5m])` | Time series |
| Saturation | Queue depth, pending requests, thread pool utilization | Time series |

**SLO Dashboard panels:**

| Panel | Query Pattern | Visualization |
|-------|---------------|---------------|
| Availability | `1 - (sum(rate(http_requests_total{status=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))` | Stat |
| Error budget remaining | `1 - (error_ratio / (1 - slo_target))` | Gauge (green/yellow/red) |
| Burn rate | `error_ratio / (1 - slo_target) * 30 * 24` | Time series + threshold |
| SLO compliance timeline | Rolling 30-day availability | Time series + target line |

### Step 4: Alert Rule Configuration

Generate alert rules linked to dashboard panels for proactive notification.

```
Tool: mcp__mcp-graph__analyze (mode: "validate_ready")
```

Alert rules per dashboard type:

| Alert | Condition | Severity | For Duration |
|-------|-----------|----------|-------------|
| High error rate | Error rate > 5% | Critical | 5 minutes |
| Elevated latency | P95 latency > 2x baseline | Warning | 10 minutes |
| SLO burn rate high | Burn rate > 2x (14.4 budget-hours/day) | Critical | 5 minutes |
| CPU saturation | CPU utilization > 85% | Warning | 15 minutes |
| Memory pressure | Memory utilization > 90% | Critical | 5 minutes |
| Disk approaching full | Disk utilization > 85% | Warning | 30 minutes |
| No traffic | Request rate = 0 for service that should have traffic | Critical | 5 minutes |

Each alert includes: notification channel, runbook link, escalation policy, and silence/inhibition rules.

### Step 5: Dashboard Export

Export generated dashboards as Grafana-compatible JSON files ready for import.

```
Tool: mcp__mcp-graph__export (format: "grafana_json", scope: "dashboards")
```

Export structure:
```
dashboards/
  executive-overview.json
  services/
    <service-name>-red.json
    <service-name>-use.json
    <service-name>-slo.json
  infrastructure/
    kubernetes-cluster.json
    database-overview.json
    cache-queue.json
```

Each JSON file follows the Grafana dashboard provisioning format:
- Dashboard metadata (title, description, tags, folder)
- Templating variables (datasource, service, namespace, environment)
- Panel definitions with queries, thresholds, and overrides
- Alert rules linked to panels
- Annotations (deployment markers, incident markers)

### Step 6: Dashboard Validation

Validate that all generated panels have valid queries and proper data source references.

```
Tool: mcp__mcp-graph__metrics (scope: "dashboard_validation")
```

Validation checks:
- All PromQL/LogQL queries parse successfully
- All referenced metrics exist in the metrics inventory
- All data source references resolve to configured data sources
- All template variables have valid query or static options
- No duplicate panel IDs within a dashboard
- Alert rules reference valid notification channels

### Step 7: Coverage Report and Memory

Generate a dashboard coverage report and save all design decisions.

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Dashboard Generation Report — <date>"
  content: "<services covered, dashboards generated, panels created, alert rules configured, coverage gaps, validation results>"
  tags: ["dashboard", "grafana", "observability", "monitoring"]
```

## Output Format

```
Phase: OBSERVABILITY DASHBOARD GENERATION
Services Inventoried: <N>
Metrics Cataloged: <N>

Dashboards Generated:
  Executive overview: 1
  Service RED: <N>
  Service USE: <N>
  Service SLO: <N>
  Infrastructure: <N>
  Total: <N>

Panels Created: <N>
Alert Rules: <N>

Coverage:
  Services with RED dashboard: <N>/<M> (<N>%)
  Services with USE dashboard: <N>/<M> (<N>%)
  Services with SLO dashboard: <N>/<M> (<N>%)
  Uncovered services: <list>

Validation:
  Query validity: <N>/<M> pass
  Data source refs: <N>/<M> resolved
  Alert rules: <N>/<M> valid

Export: <N> JSON files in dashboards/
Saved to memory: "Dashboard Generation Report — <date>"
```

## Anti-Patterns

- Do NOT create a single monolithic dashboard for all services -- per-service dashboards enable focused troubleshooting
- Do NOT hardcode metric names without template variables -- dashboards must be reusable across environments (prod, staging, dev)
- Do NOT generate panels without verifying the underlying metrics exist -- broken panels erode trust in dashboards
- Do NOT skip alert rule integration -- a dashboard without alerts is a passive artifact that only helps during active investigation
- Do NOT use inconsistent panel layouts across services -- standardized layouts reduce cognitive load when switching between services
- Do NOT ignore cardinality when designing queries -- high-cardinality label combinations in PromQL cause performance issues
- Do NOT create dashboards without documentation -- each dashboard should have a description explaining its purpose and audience
