---
name: graph-infrastructure-health-monitor
description: Continuous infrastructure health monitoring for servers, containers, Kubernetes, and VMs with composite health scoring and degradation forecasting
triggers:
  - graph-infrastructure-health-monitor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-infrastructure-health-monitor

Continuous infrastructure health monitoring that covers bare-metal servers, containers, Kubernetes clusters, and virtual machines. Computes composite health scores per resource and environment, detects degradation trends before failures, and forecasts capacity exhaustion. Technology-agnostic monitoring that works across hybrid infrastructure.

## When to Use

- When monitoring infrastructure health across heterogeneous environments (VMs + containers + bare-metal)
- When establishing proactive health baselines for new infrastructure
- When capacity planning requires degradation trend data
- When health scores need to feed into auto-scaling or auto-remediation decisions
- When validating infrastructure readiness before deployments
- When investigating intermittent performance issues tied to infrastructure degradation

## Mandatory Flow

```
discover(inventory) --> collect(metrics per resource) --> score(composite health) --> trend(degradation analysis) --> forecast(capacity exhaustion) --> alert(threshold breach) --> analyze(impact) --> write_memory
```

## Workflow

### Step 1: Infrastructure Discovery

Discover and inventory all monitored infrastructure resources. Build a topology map of hosts, clusters, and their relationships.

```
Tool: mcp__mcp-graph__metrics (scope: "infrastructure", action: "inventory")
```

Resource taxonomy:

| Resource Type | Key Attributes | Discovery Source |
|---------------|----------------|-----------------|
| Bare-metal server | hostname, CPU cores, RAM, disk, NIC | Agent, IPMI, SSH |
| Virtual machine | instance ID, vCPU, memory, hypervisor | Cloud API, vCenter |
| Container | container ID, image, resource limits | Docker API, containerd |
| Kubernetes pod | pod name, namespace, node, resource requests/limits | K8s API |
| Kubernetes node | node name, capacity, allocatable, conditions | K8s API |
| Load balancer | VIP, backend pool, health check config | Cloud API, HAProxy |

Organize resources into logical groups (environment, region, cluster, namespace).

### Step 2: Metric Collection per Resource

Collect infrastructure metrics at the resource level. Each resource type has a standard metric set.

```
Tool: mcp__mcp-graph__metrics (scope: "resources", timeRange: "1h")
```

Standard metric set per resource type:

**Compute:**
- CPU utilization (%), steal time (%), iowait (%)
- Load average (1m, 5m, 15m)
- Context switches per second

**Memory:**
- Used/available/cached/buffer (bytes and %)
- Swap usage (%), page faults per second
- OOM kill count

**Disk:**
- Utilization (%), IOPS (read/write), throughput (MB/s)
- Latency (read/write P50, P95, P99)
- Queue depth, await time

**Network:**
- Bandwidth utilization (in/out, bytes/s)
- Packet loss rate (%), retransmission rate
- Connection count (established, time_wait, close_wait)

**Kubernetes-specific:**
- Pod restart count, eviction count
- Resource request vs actual usage ratio
- Node condition statuses (Ready, MemoryPressure, DiskPressure, PIDPressure)

### Step 3: Composite Health Scoring

Compute a single health score (0-100) per resource by combining individual metric scores.

Scoring formula per metric:
- **Green (80-100):** metric within normal operating range
- **Yellow (50-79):** metric approaching warning threshold
- **Orange (25-49):** metric in warning zone, action recommended
- **Red (0-24):** metric in critical zone, immediate action required

Composite score = weighted average of individual metric scores:

| Metric Category | Weight | Rationale |
|-----------------|--------|-----------|
| CPU | 0.25 | Compute capacity directly impacts performance |
| Memory | 0.25 | Memory pressure causes OOM kills and swapping |
| Disk | 0.20 | Disk saturation blocks I/O-dependent operations |
| Network | 0.15 | Network issues cause timeouts and retries |
| Process/Container | 0.15 | Restarts and evictions indicate instability |

Environment-level score = weighted average of resource scores (weighted by resource criticality).

### Step 4: Degradation Trend Analysis

Analyze health score trends to detect gradual degradation that precedes failures.

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Trend detection methods:
- **Linear regression** -- fit a line to the last 7 days of health scores; negative slope indicates degradation
- **Change point detection** -- identify when the score distribution shifted (CUSUM, PELT algorithms)
- **Rate of change** -- compute the derivative of the health score; accelerating decline is more urgent than steady decline

Classify trends:
- **Stable** -- score variance < 5% over 7 days, no significant slope
- **Gradual decline** -- negative slope < -1 point/day
- **Accelerating decline** -- second derivative is negative (decline is speeding up)
- **Sudden drop** -- score dropped > 20 points in < 1 hour
- **Recovery** -- positive slope after a prior decline

### Step 5: Capacity Exhaustion Forecasting

Project when resources will hit critical thresholds based on current consumption trends.

```
Tool: mcp__mcp-graph__forecast (metric: "resource_utilization", resource: "<resource_id>")
```

Forecast per resource:
- **Days to disk full** -- linear projection of disk usage growth
- **Days to memory pressure** -- based on memory consumption trend and OOM frequency
- **Days to CPU saturation** -- based on load average growth relative to core count
- **Days to connection pool exhaustion** -- based on connection count growth vs limits

Forecast confidence intervals: present P50 (likely), P75 (conservative), P95 (worst case).

Flag any resource with P75 forecast < 14 days as requiring immediate attention.

### Step 6: Alert on Threshold Breach

Generate alerts when health scores breach defined thresholds or when forecasts predict imminent exhaustion.

Alert rules:

| Condition | Severity | Action |
|-----------|----------|--------|
| Health score < 25 | Critical | Page on-call, create incident task |
| Health score < 50 | Warning | Notify team channel |
| Health score declining > 5 points/day | Warning | Notify with trend data |
| Forecast exhaustion < 7 days | Critical | Capacity planning alert |
| Forecast exhaustion < 30 days | Warning | Capacity planning notice |

```
Tool: mcp__mcp-graph__analyze (mode: "validate_ready")
```

### Step 7: Record Health Report

Save the infrastructure health assessment and forecasts.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Infrastructure Health Report — <date>"
  content: "<resource inventory, health scores, degradation trends, capacity forecasts, alerts generated, recommended actions>"
  tags: ["infrastructure", "health", "monitoring", "capacity", "aiops"]
```

## Output Format

```
Phase: INFRASTRUCTURE HEALTH MONITORING
Scope: <N> resources across <N> environments
Time: <timestamp>

Health Summary:
  Green (80-100): <N> resources (<N>%)
  Yellow (50-79): <N> resources (<N>%)
  Orange (25-49): <N> resources (<N>%)
  Red (0-24): <N> resources (<N>%)

Environment Scores:
  Production: <score>/100
  Staging: <score>/100
  Development: <score>/100

Degradation Trends:
  Accelerating decline: <N> resources
  Gradual decline: <N> resources
  Stable: <N> resources

Capacity Forecasts:
  Exhaustion < 7 days: <N> resources (CRITICAL)
  Exhaustion < 30 days: <N> resources (WARNING)
  Healthy runway: <N> resources

Alerts Generated: <N> (critical: <N>, warning: <N>)
Saved to memory: "Infrastructure Health Report — <date>"
```

## Anti-Patterns

- Do NOT monitor only CPU and memory -- disk I/O and network are equally common root causes of performance degradation
- Do NOT use identical thresholds for all resource types -- a database server at 70% CPU is more concerning than a stateless worker at 70%
- Do NOT ignore Kubernetes-specific signals -- pod restarts, evictions, and resource pressure conditions indicate cluster health issues
- Do NOT forecast with less than 7 days of historical data -- short windows produce unreliable projections
- Do NOT alert on transient spikes without confirmation -- require sustained threshold breach (e.g., 5 consecutive minutes) to avoid noise
- Do NOT skip recording health trends to memory -- historical health data is essential for capacity planning and incident prevention
