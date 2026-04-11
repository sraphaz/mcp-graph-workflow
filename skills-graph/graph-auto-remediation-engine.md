---
name: graph-auto-remediation-engine
description: Auto-healing infrastructure remediation engine that detects, diagnoses, and fixes common infrastructure issues without human intervention
triggers:
  - graph-auto-remediation-engine
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-auto-remediation-engine

Auto-healing infrastructure remediation engine that autonomously detects failures, matches them against a runbook of known fixes, executes the appropriate remediation action, and verifies recovery. Handles common infrastructure issues (pod crashes, disk pressure, connection pool exhaustion, certificate expiry, DNS failures) without human intervention while maintaining strict safety guardrails.

## When to Use

- When repetitive infrastructure incidents consume on-call engineer time
- When known failure modes have documented manual runbooks that can be automated
- When mean time to resolution (MTTR) needs to decrease for tier-1 services
- When off-hours incidents need immediate automated response before human escalation
- When building self-healing Kubernetes clusters or VM fleets
- When establishing guardrails for safe automated remediation

## Mandatory Flow

```
detect(failure signal) --> classify(match runbook) --> approve(safety check) --> remediate(execute action) --> verify(confirm recovery) --> node(track action) --> search(related incidents) --> metrics(update SLA) --> analyze(blast radius) --> write_memory
```

## Workflow

### Step 1: Failure Detection

Continuously monitor for failure signals that match known remediable patterns.

```
Tool: mcp__mcp-graph__metrics (scope: "failures", timeRange: "5m")
```

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Detectable failure patterns:

| Pattern | Signal | Detection Method |
|---------|--------|-----------------|
| Pod CrashLoopBackOff | Pod restart count > 3 in 10 minutes | K8s event watch |
| OOM kill | Kernel OOM killer invocation | dmesg / kernel log |
| Disk pressure | Disk usage > 90% | Metric threshold |
| Connection pool exhaustion | Active connections = max pool size | Metric threshold |
| Certificate expiry | Days to expiry < 7 | Certificate monitor |
| Health check failure | Consecutive failures > 3 | Health check endpoint |
| DNS resolution failure | DNS lookup latency > 5s or NXDOMAIN | DNS probe |
| Memory leak | Monotonic memory growth without release | Trend detection |

Each detection includes: timestamp, affected resource, severity, signal source, and raw metric values.

### Step 2: Runbook Classification

Match the detected failure against the remediation runbook library. Each runbook defines the conditions, actions, and safety constraints for a specific failure type.

```
Tool: mcp__mcp-graph__search (query: "runbook <failure pattern>")
```

Runbook structure:

| Field | Description |
|-------|-------------|
| Trigger condition | When to activate (metric + threshold + duration) |
| Remediation action | What to do (restart, scale, clean, rotate) |
| Safety constraints | What must be true before executing (min replicas, cooldown period) |
| Blast radius | Maximum scope of the action (single pod, single node, cluster-wide) |
| Rollback action | How to undo if remediation makes things worse |
| Escalation rule | When to page a human instead of auto-remediating |

Classification confidence levels:
- **Exact match (>90%)** -- failure pattern matches a runbook precisely, auto-remediate
- **Partial match (70-89%)** -- similar pattern but some signals differ, auto-remediate with extra verification
- **Low match (<70%)** -- no clear runbook match, escalate to human

### Step 3: Safety Approval Gate

Before executing any remediation action, validate safety constraints. This gate prevents cascading failures from aggressive auto-remediation.

Safety checks:

| Check | Purpose | Block if |
|-------|---------|----------|
| Cooldown period | Prevent rapid repeated remediation | Same resource remediated < 15 minutes ago |
| Minimum replicas | Ensure service availability during restart | Restarting would drop below minimum healthy replicas |
| Concurrent actions | Prevent multiple simultaneous remediations | > 2 active remediations for the same service |
| Blast radius limit | Contain scope of automated actions | Action would affect > 25% of a service's instances |
| Change freeze | Respect maintenance windows | Active change freeze in effect |
| Escalation threshold | Limit repeated auto-remediation | Same issue auto-remediated > 3 times in 24 hours |

If any safety check fails, escalate to human with full context instead of auto-remediating.

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

### Step 4: Remediation Execution

Execute the matched runbook action with full logging and traceability.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Auto-Remediation — <failure type> — <resource>", priority: "<severity>")
```

Common remediation actions:

| Failure | Remediation | Mechanism |
|---------|-------------|-----------|
| CrashLoopBackOff | Delete pod (let controller recreate) | `kubectl delete pod` |
| OOM kill | Increase memory limit + restart | Patch resource spec |
| Disk pressure | Clean logs/tmp + expand volume | `journalctl --vacuum` + PVC resize |
| Connection pool exhaustion | Restart application + tune pool size | Rolling restart |
| Certificate expiry | Trigger cert renewal | cert-manager trigger or ACME renewal |
| Health check failure | Restart unhealthy instance | Rolling restart |
| DNS failure | Flush DNS cache + restart resolver | `systemd-resolve --flush-caches` |
| Memory leak | Rolling restart of affected pods | `kubectl rollout restart` |

All actions are logged with: timestamp, action taken, target resource, operator (auto-remediation), and ticket/node ID.

### Step 5: Recovery Verification

After remediation, verify that the failure is resolved and the service has returned to healthy state.

```
Tool: mcp__mcp-graph__metrics (scope: "health", resource: "<remediated_resource>")
```

Verification protocol:
1. Wait for stabilization period (30 seconds for pod restart, 5 minutes for scaling)
2. Re-check the original failure signal (is it still firing?)
3. Check health endpoints (is the service responding with 200?)
4. Check dependent services (did remediation cause downstream issues?)
5. Compare current metrics to pre-failure baseline

Verification outcomes:
- **Recovered** -- failure signal cleared, health check passing, metrics normalized
- **Partially recovered** -- failure signal reduced but not cleared, or new issues appeared
- **Not recovered** -- failure signal persists despite remediation
- **Degraded** -- remediation caused new issues (trigger rollback)

If not recovered or degraded, execute rollback action and escalate to human.

### Step 6: Incident Tracking and Pattern Analysis

Search for related incidents to detect recurring patterns that need architectural fixes rather than repeated auto-remediation.

```
Tool: mcp__mcp-graph__search (query: "<failure type> <resource> remediation")
```

```
Tool: mcp__mcp-graph__metrics (scope: "remediation_history")
```

Pattern detection:
- Same resource auto-remediated > 3 times in 7 days indicates an underlying issue
- Same failure type across multiple resources indicates a systemic problem
- Remediation frequency increasing over time indicates growing technical debt
- Remediation during the same time window daily indicates a load-related or batch-related issue

### Step 7: Record Remediation and Learnings

Save the complete remediation record and any discovered patterns.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Auto-Remediation Report — <failure type> <resource> <date>"
  content: "<detection signal, runbook matched, safety checks passed, action taken, verification result, recovery time, recurring pattern analysis>"
  tags: ["auto-remediation", "self-healing", "aiops", "incident"]
```

## Output Format

```
Phase: AUTO-REMEDIATION
Trigger: <failure signal>
Resource: <affected resource>
Severity: <critical/high/medium>

Detection:
  Signal: <metric/log/event>
  Value: <observed> (threshold: <expected>)
  Duration: <how long before detection>

Classification:
  Runbook: <matched runbook name>
  Confidence: <N>%
  Action: <remediation action>

Safety Gate:
  Cooldown: <pass/fail>
  Min replicas: <pass/fail>
  Blast radius: <pass/fail>
  Overall: <approved/escalated>

Execution:
  Action: <what was done>
  Target: <specific resource>
  Duration: <execution time>

Verification:
  Status: <recovered/partial/not recovered/degraded>
  Recovery time: <N> seconds
  Health check: <pass/fail>

Pattern Analysis:
  Recurrence: <N> times in <N> days
  Recommendation: <fix underlying issue / continue auto-remediation>

Saved to memory: "Auto-Remediation Report — <date>"
```

## Anti-Patterns

- Do NOT auto-remediate without safety checks -- aggressive remediation without guardrails causes cascading failures
- Do NOT bypass the cooldown period -- rapid repeated remediation of the same resource often makes things worse
- Do NOT auto-remediate failures you have never seen before -- unknown failures require human investigation first
- Do NOT skip recovery verification -- an unverified remediation might have masked the problem or created new ones
- Do NOT rely solely on auto-remediation for recurring issues -- if the same failure recurs frequently, fix the root cause
- Do NOT auto-remediate during change freezes -- automated actions during sensitive periods violate change management policies
- Do NOT exceed blast radius limits -- auto-remediating more than 25% of a service's instances simultaneously risks an outage
