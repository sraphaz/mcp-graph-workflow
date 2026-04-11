---
name: graph-etl-automation
description: Adaptive ETL automation with performance-based rules, retry logic, and self-tuning execution within the graph
triggers:
  - graph-etl-automation
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-etl-automation

Automates ETL workflows with adaptive, performance-based rules that self-tune based on historical execution metrics. Manages retry logic, backpressure handling, incremental processing, and automatic scaling of pipeline stages — all tracked as graph nodes with full observability.

## When to Use

- When ETL pipelines need automatic retry and error recovery without manual intervention
- When pipeline performance must adapt to data volume changes over time
- Before IMPLEMENT phase for any recurring data processing workflow
- When existing pipelines show degraded performance and need self-tuning optimization
- After pipeline failures to automatically diagnose, adjust, and re-execute
- During VALIDATE to verify ETL output meets quality and performance SLAs

## Mandatory Flow

```
profile data source → generate ETL rules → create automation nodes → configure retry policies → execute with monitoring → measure performance → self-tune rules → report → write_memory
```

## Workflow

### Step 1: Profile Data Source

Analyze the source data characteristics to inform ETL rule generation:

```
Tool: mcp__mcp-graph__search (query: "data source OR input OR extract OR ingest")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Profile dimensions:
- **Volume:** Total records, file sizes, growth rate
- **Velocity:** Update frequency, batch vs. streaming arrival
- **Variety:** Schema complexity, nested structures, mixed types
- **Veracity:** Null rates, outlier frequency, encoding issues

Record the profile as baseline metadata on the pipeline epic node.

### Step 2: Generate Adaptive ETL Rules

Based on the data profile, generate rules for each ETL stage:

**Extract rules:**
- Batch size: Start at 1000 records, adapt based on memory usage
- Timeout: 30s default, increase for slow sources
- Retry: 3 attempts with exponential backoff (1s, 4s, 16s)

**Transform rules:**
- Chunk size: Process in chunks matching available memory
- Parallelism: 1 worker per CPU core for CPU-bound transforms
- Validation: Fail-fast on schema violations, collect errors for batch reporting

**Load rules:**
- Transaction size: 500 records per transaction for SQLite
- Conflict resolution: Upsert by default, configurable per target
- Index rebuild: Defer index updates until after bulk load completes

### Step 3: Create Automation Nodes

Create graph nodes representing the automated ETL configuration:

```
Tool: mcp__mcp-graph__node (action: "add", name: "ETL Config — <pipeline>", type: "task", metadata: { etl_rules: { batch_size: 1000, retry_max: 3, timeout_ms: 30000 } })
Tool: mcp__mcp-graph__node (action: "add", name: "ETL Extract — <source>", type: "task", priority: "high")
Tool: mcp__mcp-graph__node (action: "add", name: "ETL Transform — <rules>", type: "task", priority: "high")
Tool: mcp__mcp-graph__node (action: "add", name: "ETL Load — <target>", type: "task", priority: "high")
```

Wire dependencies:

```
Tool: mcp__mcp-graph__edge (from: "<config-id>", to: "<extract-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<extract-id>", to: "<transform-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<transform-id>", to: "<load-id>", type: "depends_on")
```

### Step 4: Configure Retry Policies

Define retry behavior per stage with escalation:

| Retry Level | Delay | Action |
|-------------|-------|--------|
| 1st retry | 1s | Re-execute same config |
| 2nd retry | 4s | Reduce batch size by 50% |
| 3rd retry | 16s | Switch to single-record mode |
| Exhausted | — | Mark `blocked`, alert, log full error |

Record retry policies in node metadata for auditability.

### Step 5: Execute with Monitoring

Run the ETL pipeline through the graph execution engine:

```
Tool: mcp__mcp-graph__next ()
Tool: mcp__mcp-graph__update_status (nodeId: "<extract-id>", status: "in_progress")
Tool: mcp__mcp-graph__metrics ()
```

During execution, monitor:
- Records processed per second (throughput)
- Memory usage trend (should be stable, not growing)
- Error count and error rate percentage
- Stage-to-stage latency

After each stage completes:

```
Tool: mcp__mcp-graph__update_status (nodeId: "<stage-id>", status: "done")
```

### Step 6: Measure Performance

Collect execution metrics for self-tuning:

```
Tool: mcp__mcp-graph__metrics ()
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Key performance indicators:
- **Throughput:** Records/second per stage
- **Latency:** P50, P95, P99 per stage
- **Error rate:** Failures / total attempts
- **Resource usage:** Peak memory, CPU time
- **Retry rate:** Retries / total executions

Compare against previous runs stored in memory to detect trends.

### Step 7: Self-Tune Rules

Adjust ETL rules based on measured performance:

- If throughput < target: increase batch size by 25% (up to memory limit)
- If error rate > 5%: decrease batch size by 50%, enable verbose logging
- If latency P95 > SLA: add parallelism or reduce transform complexity
- If retry rate > 10%: investigate root cause, adjust timeout or source connection pool
- If memory usage > 80%: reduce chunk size, enable streaming mode

Update the ETL config node metadata with new tuned parameters:

```
Tool: mcp__mcp-graph__node (action: "update", id: "<config-id>", metadata: { etl_rules: { batch_size: <tuned>, retry_max: <tuned> } })
```

### Step 8: Generate Report and Persist

Save the ETL execution and tuning report:

```
Tool: mcp__mcp-graph__write_memory (title: "ETL Automation Report — <pipeline> — <date>", content: <report>)
```

## Output Format

```
Phase: ETL AUTOMATION
Pipeline: <pipeline-name>
Source Profile: <volume> records, <velocity> updates/day, <variety> schema complexity
Stages: Extract (<N>s) → Transform (<N>s) → Load (<N>s)
Throughput: <N> records/sec (target: <N>)
Error Rate: <N>% (<N> failures, <N> retries)
Self-Tuning Adjustments:
  - batch_size: <old> → <new>
  - timeout_ms: <old> → <new>
  - parallelism: <old> → <new>
Performance vs Previous: <+/-N>% throughput, <+/-N>% error rate
Status: PASS | DEGRADED | FAIL
Recommendations: <top 3 tuning actions>

Saved to memory: "ETL Automation Report — <pipeline> — <date>"
```

## Anti-Patterns

- Do NOT use fixed batch sizes — always adapt based on measured performance and data volume
- Do NOT retry indefinitely — set a maximum retry count with escalation, then mark as `blocked`
- Do NOT ignore error patterns — repeated failures on the same records indicate a systemic issue, not transient errors
- Do NOT skip profiling — ETL rules without source profiling lead to either over-provisioning or failures
- Do NOT tune multiple parameters simultaneously — change one variable at a time to isolate impact
- Do NOT run ETL without metrics collection — unmonitored pipelines degrade silently
- Do NOT hardcode connection parameters — store configuration in node metadata for portability and auditability
