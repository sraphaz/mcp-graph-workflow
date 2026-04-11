---
name: graph-infrastructure-scaling-recommender
description: Auto-scaling recommendations for horizontal and vertical scaling based on real-time observability data, capacity forecasting, and cost optimization
triggers:
  - graph-infrastructure-scaling-recommender
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-infrastructure-scaling-recommender

Auto-scaling recommendation engine that analyzes real-time observability data, historical usage patterns, and capacity forecasts to produce actionable horizontal and vertical scaling recommendations. Balances performance headroom against cost efficiency, respects scaling constraints, and accounts for lead times and cool-down periods.

## When to Use

- When infrastructure costs are growing and right-sizing is needed
- When performance SLAs require scaling before traffic peaks arrive
- When deciding between horizontal scaling (more instances) and vertical scaling (bigger instances)
- When Kubernetes HPA/VPA configurations need data-driven tuning
- When preparing for known traffic events (product launches, sales, seasonal peaks)
- When optimizing cloud spend by identifying over-provisioned resources

## Mandatory Flow

```
collect(resource utilization metrics) --> profile(usage patterns) --> forecast(demand prediction) --> recommend(scaling actions) --> cost(impact analysis) --> validate(safety constraints) --> metrics(track recommendations) --> analyze(accuracy review) --> write_memory
```

## Workflow

### Step 1: Resource Utilization Collection

Gather current and historical resource utilization metrics for all scalable resources.

```
Tool: mcp__mcp-graph__metrics (scope: "utilization", timeRange: "7d")
```

Metrics per resource:

| Resource Type | Key Metrics | Scaling Dimension |
|---------------|-------------|-------------------|
| Kubernetes Deployment | CPU request/limit/actual, memory request/limit/actual, pod count | HPA (horizontal), VPA (vertical) |
| VM/Instance | CPU %, memory %, network I/O, disk I/O | Vertical (instance type), horizontal (instance count) |
| Database | Connections, query latency, IOPS, storage | Vertical (instance class), read replicas (horizontal) |
| Queue/Stream | Consumer lag, message rate, partition count | Horizontal (consumer count, partitions) |
| Load Balancer | Request rate, active connections, backend health | Backend instance count |
| Cache | Hit rate, eviction rate, memory usage, connection count | Vertical (instance size), horizontal (cluster nodes) |

Compute utilization ratios: actual usage / allocated capacity for each resource.

### Step 2: Usage Pattern Profiling

Profile usage patterns to understand how demand varies over time and identify predictable patterns.

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Pattern categories:

| Pattern | Description | Scaling Implication |
|---------|-------------|---------------------|
| Steady state | Consistent utilization with low variance | Right-size to match steady load + headroom |
| Daily cycle | Peak during business hours, low at night | Schedule-based scaling or predictive HPA |
| Weekly cycle | Higher on weekdays, lower on weekends | Weekly schedule overlay |
| Spiky | Sudden unpredictable bursts | Aggressive horizontal scale-out with fast cool-down |
| Growth trend | Monotonic utilization increase over weeks | Proactive vertical scaling or capacity expansion |
| Event-driven | Correlated with deployments, batch jobs, or marketing events | Pre-scaling based on event calendar |

Decompose each metric into: trend (long-term direction), seasonality (repeating pattern), and residual (noise/spikes).

### Step 3: Demand Forecasting

Forecast future resource demand based on identified patterns and growth trends.

```
Tool: mcp__mcp-graph__forecast (metric: "resource_demand", horizon: "7d")
```

Forecast per resource:
- Point forecast at each time step (hourly or 15-minute resolution)
- 80% and 95% prediction intervals
- Peak demand forecast (maximum expected demand in the forecast window)
- Time of peak (when the highest demand is expected)

Scaling trigger points:
- **Scale-out point:** forecasted demand exceeds current capacity * (1 - headroom). Default headroom: 20%.
- **Scale-in point:** forecasted demand falls below current capacity * (1 - wastage threshold). Default wastage: 40%.

### Step 4: Scaling Recommendation Generation

Generate specific scaling recommendations based on forecast and utilization analysis.

Recommendation types:

| Type | When | Action |
|------|------|--------|
| **Scale up (vertical)** | Single-instance bottleneck, CPU/memory limited | Increase instance size, resource limits |
| **Scale out (horizontal)** | Load distributable, multiple instances feasible | Increase replica count, add nodes |
| **Scale down (vertical)** | Over-provisioned, utilization < 30% sustained | Decrease instance size, resource limits |
| **Scale in (horizontal)** | Too many replicas, utilization < 20% per instance | Reduce replica count |
| **Right-size** | Mismatched resource ratios (e.g., CPU-heavy instance for memory-heavy workload) | Change instance type/class |
| **Pre-scale** | Known upcoming event with expected traffic increase | Schedule scale-out before event |

Per recommendation include:
- Current state (instance type, count, utilization)
- Recommended state (new type, count, expected utilization)
- Rationale (which metric drives this recommendation)
- Confidence (based on forecast accuracy for this resource)
- Lead time (how long before the recommended change takes effect)

```
Tool: mcp__mcp-graph__metrics (scope: "scaling_recommendations")
```

### Step 5: Cost Impact Analysis

Calculate the cost impact of each scaling recommendation to enable cost-aware decisions.

```
Tool: mcp__mcp-graph__forecast (metric: "cost_impact", recommendations: "current")
```

Cost analysis per recommendation:

| Metric | Current | Recommended | Delta |
|--------|---------|-------------|-------|
| Monthly compute cost | $X | $Y | +/- $Z |
| Cost per request | $X | $Y | +/- $Z |
| Utilization efficiency | X% | Y% | +/- Z% |
| Performance headroom | X% | Y% | +/- Z% |

Cost optimization strategies:
- **Spot/preemptible instances** -- for stateless horizontal scale-out (60-90% cost reduction)
- **Reserved/committed use** -- for stable baseline capacity (30-60% cost reduction)
- **Scheduled scaling** -- scale down during off-peak hours (20-40% cost reduction)
- **Right-sizing** -- match instance type to workload profile (10-30% cost reduction)

Compute ROI: cost savings vs effort to implement each recommendation.

### Step 6: Safety Constraint Validation

Validate each recommendation against safety constraints before presenting.

```
Tool: mcp__mcp-graph__analyze (mode: "validate_ready")
```

Safety constraints:

| Constraint | Check | Block if |
|------------|-------|----------|
| Minimum instances | Service requires minimum N instances for HA | Scale-in would go below minimum |
| Maximum instances | Budget or infrastructure ceiling | Scale-out would exceed maximum |
| Anti-affinity | Instances must be spread across zones/nodes | Not enough zones for recommended count |
| Disruption budget | Maximum % of pods that can be unavailable | Scaling action exceeds disruption budget |
| Cool-down period | Minimum time between scaling actions | Last scaling action was too recent |
| Dependency capacity | Downstream services can handle the new load | Database connections, queue throughput insufficient |

Remove or flag recommendations that violate safety constraints.

### Step 7: Record Recommendations and Track Accuracy

Save scaling recommendations and track how accurate previous recommendations were.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Scaling Recommendations — <date>"
  content: "<resource utilization summary, usage patterns, demand forecast, scaling recommendations, cost impact analysis, safety validations, recommendation accuracy from previous cycle>"
  tags: ["scaling", "capacity", "cost-optimization", "aiops"]
```

Track recommendation accuracy:
- Did the forecasted demand match actual demand? (MAPE)
- Did the scaling recommendation prevent an SLA breach?
- Did cost savings materialize as predicted?
- Were any recommendations rolled back?

## Output Format

```
Phase: INFRASTRUCTURE SCALING RECOMMENDATIONS
Resources Analyzed: <N>
Forecast Horizon: <N> days

Utilization Summary:
  Over-provisioned (< 30% util): <N> resources
  Right-sized (30-70% util): <N> resources
  Under-provisioned (> 70% util): <N> resources

Recommendations:
  Scale out: <N> (est. cost impact: +$<N>/mo)
  Scale up: <N> (est. cost impact: +$<N>/mo)
  Scale in: <N> (est. cost savings: -$<N>/mo)
  Scale down: <N> (est. cost savings: -$<N>/mo)
  Right-size: <N> (est. cost savings: -$<N>/mo)
  Pre-scale: <N> (event: <name>, date: <date>)

Net Monthly Cost Impact: +/- $<N>
Safety Violations: <N> recommendations blocked

Top 3 Recommendations:
  1. <resource> — <action> — savings/cost: $<N>/mo — confidence: <N>%
  2. <resource> — <action> — savings/cost: $<N>/mo — confidence: <N>%
  3. <resource> — <action> — savings/cost: $<N>/mo — confidence: <N>%

Saved to memory: "Scaling Recommendations — <date>"
```

## Anti-Patterns

- Do NOT recommend scaling based on a single metric in isolation -- consider CPU, memory, network, and application-level metrics together
- Do NOT scale horizontally when the bottleneck is a single-threaded process or a single database connection -- vertical scaling or architectural change is needed
- Do NOT ignore cost implications -- scaling recommendations without cost context lead to budget overruns
- Do NOT scale aggressively without cool-down periods -- rapid scale-out/scale-in oscillation (thrashing) destabilizes services
- Do NOT forecast demand with less than 7 days of data -- seasonal patterns need at least one full cycle to detect
- Do NOT recommend scaling down tier-1 production services without a safety buffer -- always maintain minimum headroom for unexpected spikes
- Do NOT treat all resources identically -- databases, caches, and stateless workers have fundamentally different scaling characteristics
