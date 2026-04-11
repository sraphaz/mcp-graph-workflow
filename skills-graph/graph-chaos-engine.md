---
name: graph-chaos-engine
description: Injects controlled failures into the execution graph to measure recovery, blast radius, and fault tolerance
triggers:
  - graph-chaos-engine
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-chaos-engine

Autonomous skill for Chaos Engineering on the execution graph. Injects controlled failures -- edge deletion, node corruption, traversal delays, race conditions, and dependency breakage -- in shadow or canary mode to measure recovery time, blast radius, and fault tolerance score. Based on principles from Netflix Chaos Monkey, Gremlin, and LitmusChaos. All experiments run against shadow copies or canary subgraphs; production graph integrity is never compromised.

## When to Use

- When validating graph resilience before a major release or migration
- When adding new edge types or node relationships and need to verify graceful degradation
- When the graph has grown complex enough that failure modes are no longer obvious
- When onboarding new integration agents and need to test fault isolation
- When post-incident review reveals a failure mode that was not previously tested
- When measuring Mean Time To Recovery (MTTR) for the execution graph under adversarial conditions

## Mandatory Flow

```
export(snapshot) → analyze(blast_radius) → [inject fault in shadow] → metrics(recovery) → [verify isolation] → analyze(fault_tolerance) → node(chaos_report) → write_memory
```

## Workflow

### Step 1: Snapshot the Graph

Create a full snapshot of the current execution graph to serve as the baseline. All chaos experiments run against a shadow copy derived from this snapshot.

- `Tool: mcp__mcp-graph__export` — format: `json`, capture full graph state (nodes, edges, metadata)
- Store the snapshot with a unique experiment ID and timestamp
- Verify snapshot integrity by comparing node/edge counts against the live graph

### Step 2: Define Experiment Scope

Select the chaos experiment type and configure its parameters. Each experiment targets a specific failure mode.

| Experiment Type | Fault Injected | Parameters | Recovery Signal |
|----------------|---------------|------------|-----------------|
| Edge Deletion | Remove critical dependency edges | target_edges, deletion_%, cascade_mode | All dependent nodes detect missing deps |
| Node Corruption | Corrupt node metadata (status, priority, type) | target_nodes, corruption_type, field_mask | Validation catches corrupt data on read |
| Traversal Delay | Inject latency into graph traversal queries | delay_ms, jitter_%, affected_queries | System operates within SLA despite delays |
| Race Condition | Concurrent conflicting writes to same node | concurrency_level, write_fields, timing_offset | Last-write-wins or conflict detection fires |
| Dependency Cascade | Mark a dependency as `failed`, observe cascade | root_node, failure_depth, propagation_mode | Cascade halts at circuit breaker boundary |
| Orphan Injection | Create nodes with no parent or edges | orphan_count, node_types | Orphan detection finds and flags them |

- `Tool: mcp__mcp-graph__analyze` — mode: `review_ready`, assess current graph health before injection
- Select experiment based on the area under test or recent incident patterns

### Step 3: Configure Shadow/Canary Mode

All experiments must run in one of two isolation modes. Never inject faults directly into the production graph.

- **Shadow Mode**: Clone the entire graph into an in-memory SQLite database. Run the experiment against the clone. Compare outcomes against the live graph. Zero risk to production.
- **Canary Mode**: Select a small subgraph (one epic and its children). Apply the fault only to the canary subgraph. Monitor for containment -- the fault must not leak to non-canary nodes.
- `Tool: mcp__mcp-graph__node` — action: `add`, create a chaos experiment tracking node with mode, scope, and parameters
- `Tool: mcp__mcp-graph__edge` — connect the experiment node to affected target nodes for traceability

### Step 4: Inject the Fault

Execute the fault injection against the shadow or canary target. Record the exact mutation applied and the timestamp.

- For edge deletion: remove the selected edges from the shadow graph and record edge IDs
- For node corruption: modify the selected fields with invalid or conflicting values
- For traversal delay: wrap graph queries with artificial latency injection
- For race conditions: issue concurrent writes using parallel async operations
- For dependency cascade: set the root node status to `failed` and trigger dependency resolution
- For orphan injection: insert nodes with no connecting edges
- `Tool: mcp__mcp-graph__metrics` — record injection timestamp, fault type, and affected entity count

### Step 5: Measure Recovery

Observe how the system responds to the injected fault. Measure key resilience metrics.

| Metric | Definition | Target |
|--------|-----------|--------|
| Detection Time | Time from fault injection to first detection signal | < 500ms |
| Recovery Time (MTTR) | Time from detection to full graph consistency restored | < 5s for shadow, < 30s for canary |
| Blast Radius | Number of nodes/edges affected by the fault cascade | Contained to target subgraph |
| Data Integrity | Percentage of nodes with valid, consistent state post-recovery | 100% |
| Fault Tolerance Score | Composite: (1 - blast_radius/total_nodes) * (1 - MTTR/SLA) * integrity | 0-100, target > 80 |

- `Tool: mcp__mcp-graph__metrics` — record detection time, recovery time, blast radius, and integrity score
- `Tool: mcp__mcp-graph__analyze` — mode: `done_integrity`, verify graph consistency after recovery

### Step 6: Verify Fault Isolation

Confirm that the fault did not leak beyond the intended scope. This is the most critical validation step.

- Compare the live production graph against the pre-experiment snapshot
- In canary mode: verify that non-canary nodes are completely unaffected (zero diff)
- In shadow mode: verify that the live graph has zero mutations from the experiment
- `Tool: mcp__mcp-graph__export` — format: `json`, export current live graph for comparison
- `Tool: mcp__mcp-graph__analyze` — mode: `status_flow`, verify no unintended status transitions occurred

### Step 7: Generate Chaos Report

Create a structured report node in the graph documenting the experiment results.

- `Tool: mcp__mcp-graph__node` — action: `update`, update the experiment tracking node with results
- Include: experiment type, mode, fault parameters, all metrics, pass/fail verdict
- Verdict criteria: Fault Tolerance Score >= 80 AND blast radius contained AND data integrity = 100%
- `Tool: mcp__mcp-graph__edge` — link the report node to any nodes that need resilience improvements

### Step 8: Persist Findings

Record chaos experiment outcomes and discovered vulnerabilities for future reference.

- `Tool: mcp__mcp-graph__write_memory` — save experiment results, discovered failure modes, and recommended hardening actions
- Tag memory with `chaos-engineering`, `resilience`, experiment type, and affected modules
- If the experiment revealed a new failure mode, create a remediation task node
- `Tool: mcp__mcp-graph__node` — action: `add`, create remediation tasks for any discovered vulnerabilities

## Output Format

```
## Chaos Experiment Report

### Experiment
- ID: {experiment_id}
- Type: {edge_deletion|node_corruption|traversal_delay|race_condition|dependency_cascade|orphan_injection}
- Mode: {shadow|canary}
- Target: {subgraph description}
- Timestamp: {ISO 8601}

### Fault Injected
- Description: {what was mutated}
- Affected entities: {N nodes, M edges}
- Parameters: {key=value pairs}

### Resilience Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Detection Time | {ms} | < 500ms | {pass/fail} |
| Recovery Time (MTTR) | {ms} | < 5000ms | {pass/fail} |
| Blast Radius | {N}/{total} nodes | contained | {pass/fail} |
| Data Integrity | {%} | 100% | {pass/fail} |
| Fault Tolerance Score | {score}/100 | > 80 | {pass/fail} |

### Verdict: {PASS/FAIL}

### Discovered Vulnerabilities
- {vulnerability description + severity + remediation}

### Remediation Tasks Created
| Node ID | Title | Priority |
|---------|-------|----------|
| {id}    | {title} | {priority} |

### Knowledge Persisted
- Memory ID: {id}
- Tags: {tags}
```

## Anti-Patterns

- Do NOT inject faults directly into the production graph -- always use shadow or canary mode
- Do NOT run chaos experiments without a pre-experiment snapshot for rollback verification
- Do NOT skip the fault isolation verification step; an uncontained fault defeats the purpose
- Do NOT treat a passing Fault Tolerance Score as proof of total resilience; rotate experiment types
- Do NOT run multiple chaos experiments concurrently on overlapping subgraphs; results become uninterpretable
- Do NOT ignore low-severity findings; small blast radius today can cascade after graph growth
- Do NOT use chaos experiments as a substitute for unit and integration testing; chaos validates emergent behavior, not correctness
