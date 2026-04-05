---
name: graph-monitoring
description: Monitoring and alerting setup using Prometheus/Grafana patterns, SLO definition, alert rule generation, dashboard template creation, and anomaly detection configuration
triggers:
  - graph-monitoring
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-monitoring

Monitoring and alerting setup using Prometheus/Grafana patterns, SLO definition, alert rule generation, dashboard template creation, and anomaly detection configuration. Ensures production readiness with actionable observability.

## When to Use

- Before DEPLOY phase for production readiness
- When setting up observability stack
- When SLOs need definition
- When alert fatigue is a problem
- During LISTENING phase for monitoring improvements

## Mandatory Flow

```
SLO definition -> metric inventory -> alert rules -> dashboard design -> anomaly detection -> runbook linking -> report -> write_memory
```

## Workflow

### Step 1: SLO Definition

Define Service Level Objectives for critical paths:

| SLO | SLI (Indicator) | Target | Error Budget | Window |
|-----|-----------------|--------|-------------|--------|
| API availability | Successful responses / total requests | 99.9% | 0.1% (~43min/month) | 30 days |
| MCP tool response time | P95 latency of tool invocations | <2s | 5% of calls >2s | 7 days |
| RAG context quality | Average relevance score per query | >0.7 | 30% of queries <0.7 | 7 days |
| Build success rate | Successful builds / total builds | >95% | 5% failures | 30 days |

Use DORA metrics as baseline via `mcp__mcp-graph__forecast(mode:"dora")`.

For each SLO: define SLI, target, error budget, and measurement window.

### Step 2: Metric Inventory

Catalog all available metrics:

| Category | Metrics | Source |
|----------|---------|--------|
| DORA | Deployment frequency, lead time, change failure rate, MTTR | `mcp__mcp-graph__forecast` |
| RAG | Trace latency, token usage, cache hit ratio | `mcp__mcp-graph__rag_context` |
| Knowledge | Quality scores, staleness, budget zones | `mcp__mcp-graph__knowledge_stats` |
| Graph | Velocity, completion rate, burndown | `mcp__mcp-graph__metrics` |

Identify gaps: what should be measured but isn't? Document missing metrics for future instrumentation.

### Step 3: Alert Rule Generation

For each SLO, define alert rules:

| Alert | Expression | Duration | Severity |
|-------|-----------|----------|----------|
| SLO_breach_api_availability | `error_rate > 0.001` | 5m | critical |
| SLO_warning_api_availability | `error_budget_consumed > 0.8` | 15m | warning |
| SLO_breach_mcp_latency | `p95_latency > 2s` | 5m | critical |
| SLO_warning_mcp_latency | `p95_latency > 1.5s` | 10m | warning |

Pattern:
```yaml
alert: SLO_breach_<service>_<metric>
expr: <prometheus_query>
for: 5m
labels:
  severity: critical
```

Avoid alert fatigue:
- Max 5 critical alerts
- Group related alerts
- Warning at 80% error budget consumed, critical at 100%

### Step 4: Dashboard Design

Create dashboard templates for each audience:

| Dashboard | Audience | Key Panels |
|-----------|----------|------------|
| Overview | Leadership | SLO status, error budgets, DORA metrics |
| RAG Health | Engineers | Trace latency, cache hit ratio, knowledge quality, token budget zones |
| Development | Sprint team | Velocity, burndown, task completion, sprint health |
| Operations | On-call | Build status, deploy frequency, incident count |

Use mermaid or ASCII art for layout. Reference existing metrics tools (`mcp__mcp-graph__metrics`, `mcp__mcp-graph__forecast`).

### Step 5: Anomaly Detection

Define baseline patterns and deviation thresholds:

| Anomaly | Baseline | Threshold | Alert Type |
|---------|----------|-----------|------------|
| Token usage spike | Rolling 7-day average | >2x average | warning |
| Build time regression | Last 10 builds average | >50% increase | warning |
| Test count decrease | Previous release count | Any drop | critical |
| Knowledge quality decay | Rolling 7-day average | >10% score drop | warning |

Alert on deviations from baseline, not absolute thresholds. This catches slow degradation that fixed thresholds miss.

### Step 6: Runbook Linking

For each alert, link to a corresponding runbook:

1. Use `mcp__mcp-graph__search(query:"runbook")` to find existing runbooks
2. For missing runbooks, create via `/graph-incident` workflow
3. Ensure every critical alert has a documented response procedure
4. Runbook must include: triage steps, escalation path, rollback procedure

Verify runbook coverage: every critical alert MUST have a runbook. Warning alerts SHOULD have one.

### Step 7: Monitoring Report

Generate report and save to memory:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Monitoring Setup — <date>"
  content: "<SLO compliance, alert rules, dashboard coverage, anomaly rules, runbook coverage>"
  tags: ["monitoring", "slo", "alerting", "observability"]
```

## Output Format

```
Phase: MONITORING SETUP
SLO Count: N defined (N% compliant)
Alert Rules: N critical / N warning
Dashboards: N defined (audiences: leadership, engineering, sprint, ops)
Anomaly Rules: N defined
Runbook Coverage: N% of critical alerts, N% of warning alerts
Monitoring Gaps: N metrics missing instrumentation
Overall Readiness Grade: A-F

Saved to memory: "Monitoring Setup — <date>"
```

## Anti-Patterns

- Do NOT create alerts without runbooks — alerts without action cause fatigue
- Do NOT set SLOs without measuring SLIs first — unrealistic targets waste error budget
- Do NOT alert on symptoms without root cause indicators
- Do NOT create dashboards nobody checks — fewer better dashboards
- Do NOT ignore anomaly detection — threshold alerts miss slow degradation
- Do NOT set all alerts to critical — use warning for early signals
