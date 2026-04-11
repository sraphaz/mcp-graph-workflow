---
name: graph-iot-sensor-event-trigger
description: Event-based triggers from sensor data creating automated alert tasks and dependency edges
triggers:
  - graph-iot-sensor-event-trigger
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-event-trigger

Orchestrates event-driven automation where sensor readings that cross defined thresholds or match complex patterns automatically create task nodes, alert edges, and remediation workflows in the execution graph. Transforms passive sensor monitoring into active, graph-integrated response pipelines.

## When to Use

- When sensor readings crossing a threshold should automatically create an alert task node (e.g., "temp > 30C")
- When complex event patterns across multiple sensors should trigger coordinated response workflows
- When building escalation chains that create dependency edges between detection, investigation, and remediation tasks
- When automating incident response by linking sensor events to predefined runbook task templates
- When implementing dead-man switches that trigger if expected sensor data stops arriving

## Mandatory Flow

```
search(existing trigger rules) → node(add trigger rule task) → edge(define escalation dependencies) → analyze(tdd_check) → implement triggers with TDD → write_memory(trigger rules) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Inventory Existing Trigger Rules

Search the graph for previously defined sensor trigger rules, alert nodes, and escalation workflows.

**Tool:** `mcp__mcp-graph__node`
- Action: `list`
- Filter by type: `trigger`, `alert`, or tags containing `sensor-event`

### Step 2: Define Trigger Rule Specifications

Create task nodes for each trigger rule category. Each rule specifies the condition, the action to take, and the escalation path.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Include acceptance criteria: trigger latency, false positive rate, deduplication window

### Step 3: Implement Simple Threshold Triggers

Build threshold-based triggers that evaluate single sensor readings against static or dynamic bounds:

- **Static threshold:** `temperature > 30C`, `humidity < 20%`, `vibration > 5g`
- **Dynamic threshold:** Percentage deviation from rolling 24h average
- **Rate threshold:** Rate of change exceeding limit (e.g., `delta_temp > 2C/min`)
- **Dead-band:** Hysteresis to prevent rapid on/off triggering at boundary values

Each trigger fires exactly once per crossing (edge-triggered, not level-triggered) with configurable cooldown.

### Step 4: Implement Complex Event Processing (CEP)

Build pattern-based triggers that correlate multiple sensor readings across time and space:

- **Sequence patterns:** Sensor A fires, then Sensor B fires within N seconds
- **Conjunction patterns:** Sensor A AND Sensor B both above threshold simultaneously
- **Absence patterns:** Expected reading not received within timeout (dead-man switch)
- **Frequency patterns:** More than N anomalies within time window T

### Step 5: Implement Automated Node Creation

When a trigger fires, automatically create task nodes in the execution graph:

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Title: Generated from trigger template (e.g., "ALERT: Temperature exceeded 30C in Zone A")
- Priority: Derived from trigger severity
- Status: `ready`
- Tags: `auto-generated`, `sensor-alert`, sensor ID, zone

### Step 6: Build Escalation Dependency Chains

Link automatically created alert nodes into escalation workflows using dependency edges:

**Tool:** `mcp__mcp-graph__edge`
- Create edges: `detection_node → investigation_node → remediation_node`
- Edge type: `depends_on`
- Ensures investigation cannot start until detection is acknowledged, remediation waits for investigation

### Step 7: Implement Deduplication and Throttling

Prevent trigger storms from creating excessive graph nodes:

- **Deduplication window:** Suppress duplicate triggers for same sensor + rule within configurable window (default: 5 min)
- **Throttle limit:** Maximum N alert nodes per rule per hour
- **Aggregation:** Batch multiple related triggers into a single summary node if firing rate exceeds threshold
- **Auto-resolve:** Close alert nodes if condition clears within grace period

### Step 8: Validate Trigger Pipeline

Run end-to-end tests with synthetic sensor data that intentionally crosses thresholds and matches CEP patterns.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: trigger latency, false positive rate, node creation correctness, edge wiring, deduplication

### Step 9: Record Trigger Configuration

Persist trigger rules, escalation templates, and deduplication settings.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `operations`
- Content: trigger rule definitions, escalation chain templates, throttling parameters

## Output Format

```yaml
event_trigger_report:
  rules_configured:
    - name: high_temperature
      condition: "temperature > 30C"
      type: threshold
      severity: critical
      cooldown: "5m"
      action: create_alert_node
    - name: rapid_pressure_drop
      condition: "delta_pressure < -10hPa/min"
      type: rate
      severity: warning
      cooldown: "10m"
      action: create_alert_node
    - name: sensor_offline
      condition: "no_reading_for > 5m"
      type: dead_man
      severity: critical
      cooldown: "30m"
      action: create_alert_node + escalation_chain
    - name: multi_zone_heat
      condition: "temp > 28C in >= 3 zones within 10m"
      type: cep_conjunction
      severity: critical
      action: create_incident_workflow
  deduplication:
    window: "5m"
    throttle_max_per_hour: 10
    auto_resolve_grace: "15m"
  execution_stats:
    triggers_evaluated: 48000
    triggers_fired: 23
    nodes_created: 19
    edges_created: 38
    duplicates_suppressed: 7
    avg_trigger_latency_ms: 3.1
```

## Anti-Patterns

- Do NOT use level-triggered evaluation; use edge-triggered with hysteresis to prevent trigger storms
- Do NOT create alert nodes without deduplication; repeated triggers for the same condition flood the graph
- Do NOT hardcode trigger thresholds in source code; use a configurable rule engine
- Do NOT skip escalation edges; isolated alert nodes without dependencies become orphaned and ignored
- Do NOT fire complex event patterns without a time window bound; unbounded correlation is a memory leak
- Do NOT auto-create nodes without throttle limits; a malfunctioning sensor can create thousands of nodes
- Do NOT ignore dead-man switches; sensor silence is often more critical than noisy readings
