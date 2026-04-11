---
name: graph-aiops-root-cause-analyzer
description: Automated root cause analysis with metric, log, and trace correlation using causal inference and dependency graph traversal
triggers:
  - graph-aiops-root-cause-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-aiops-root-cause-analyzer

Automated root cause analysis that correlates metrics, logs, and traces to pinpoint the origin of incidents. Uses causal inference (Granger causality, Bayesian networks), dependency graph traversal, and temporal correlation to narrow down from hundreds of symptoms to a single root cause. Reduces mean time to resolution (MTTR) by eliminating manual correlation work.

## When to Use

- When an incident has multiple correlated symptoms across services and the root cause is unclear
- When anomaly detection triggers alerts on multiple metrics simultaneously
- When on-call engineers need automated first-pass triage before manual investigation
- When post-incident reviews require a causal chain reconstruction
- When service dependency graphs are complex enough that manual tracing is impractical
- When recurring incidents need pattern matching against historical root causes

## Mandatory Flow

```
gather(symptoms) --> search(related signals) --> build(dependency graph) --> traverse(causal chain) --> score(root cause candidates) --> rag_context(historical incidents) --> validate(hypothesis) --> node(remediation task) --> analyze(impact) --> write_memory
```

## Workflow

### Step 1: Symptom Collection

Gather all active symptoms -- anomalous metrics, error logs, failing health checks, degraded traces. Each symptom is an observation, not a root cause.

```
Tool: mcp__mcp-graph__search (query: "status:failed OR status:blocked OR anomaly")
```

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Symptom taxonomy:

| Category | Examples | Signal Type |
|----------|----------|-------------|
| Availability | Service down, health check failing, connection refused | Metrics + Logs |
| Performance | Latency spike, throughput drop, queue depth increase | Metrics + Traces |
| Error rate | 5xx spike, exception surge, retry storm | Metrics + Logs |
| Resource | CPU saturation, memory pressure, disk full, OOM kills | Metrics |
| Data | Inconsistency, replication lag, stale cache, corruption | Logs + Traces |

Collect timestamps for each symptom to establish temporal ordering.

### Step 2: Signal Correlation Search

Search for related signals that may not have triggered alerts but provide causal context.

```
Tool: mcp__mcp-graph__search (query: "<service name> <time window>")
```

```
Tool: mcp__mcp-graph__rag_context (query: "incident <service> <symptom type>")
```

Expand the signal search:
- **Upstream services** -- did a dependency degrade before the symptom appeared?
- **Downstream services** -- are consumers showing cascading failures?
- **Infrastructure** -- did a node, pod, or VM change state (restart, OOM, eviction)?
- **Deployments** -- was there a deployment within the symptom window?
- **Configuration changes** -- did any config, feature flag, or DNS change occur?

### Step 3: Dependency Graph Construction

Build or retrieve the service dependency graph to understand which services can affect which others.

```
Tool: mcp__mcp-graph__analyze (mode: "design_ready")
```

Dependency graph sources:
- **Static** -- service manifest, Kubernetes service definitions, API gateway routes
- **Dynamic** -- trace-derived call graphs (OpenTelemetry), network flow logs
- **Data** -- shared database dependencies, cache dependencies, queue consumers/producers

Annotate edges with:
- Call direction (A calls B)
- Protocol (HTTP, gRPC, message queue, shared DB)
- Criticality (is this a hard or soft dependency?)
- Historical failure correlation (when A fails, does B usually follow?)

### Step 4: Causal Chain Traversal

Walk the dependency graph from symptoms backward toward potential root causes using temporal ordering.

Traversal algorithm:
1. Start at each symptom node
2. For each node, check upstream dependencies
3. If an upstream dependency also shows anomalous behavior AND its anomaly started earlier, it is a stronger root cause candidate
4. Continue traversing upstream until reaching a node with no upstream anomalies (this is the root cause candidate)
5. Score candidates by how many symptom chains converge on them

```
Tool: mcp__mcp-graph__search (query: "<upstream service> errors <time window>")
```

Causal inference methods:
- **Temporal precedence** -- the cause must precede the effect (earlier anomaly timestamp)
- **Granger causality** -- statistical test for whether one time series helps predict another
- **Bayesian network** -- probabilistic model of causal relationships learned from historical data
- **Counterfactual analysis** -- would the symptom have occurred if the candidate cause had not?

### Step 5: Root Cause Candidate Scoring

Score each root cause candidate based on multiple evidence dimensions.

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Temporal precedence | 0.25 | Did this anomaly start before all downstream symptoms? |
| Convergence count | 0.25 | How many independent symptom chains point to this cause? |
| Historical match | 0.20 | Does this match a known root cause pattern from past incidents? |
| Dependency centrality | 0.15 | How central is this service in the dependency graph? |
| Change proximity | 0.15 | Was there a recent deployment, config change, or scaling event? |

Final score = weighted sum. Present top 3 candidates ranked by score.

### Step 6: Historical Pattern Matching

Query the knowledge store for similar past incidents to validate or enrich the hypothesis.

```
Tool: mcp__mcp-graph__rag_context (query: "root cause <top candidate service> <symptom pattern>")
```

Match against:
- Previous incidents with the same root cause service
- Similar symptom combinations (fingerprint matching)
- Seasonal patterns (end-of-month batch, peak hour traffic)
- Known failure modes for the candidate technology (e.g., connection pool exhaustion, GC pause storms)

If a historical match is found with >80% similarity, inherit the previous remediation steps as the starting point.

### Step 7: Hypothesis Validation

Validate the top root cause hypothesis with targeted investigation.

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Validation checks:
- Does the timeline support causation? (Root cause anomaly started before all symptoms)
- Does fixing/reverting the root cause resolve downstream symptoms? (If a rollback is possible)
- Are there alternative explanations that score comparably? (If yes, investigate further)
- Does the root cause explain ALL observed symptoms? (If not, there may be multiple root causes)

### Step 8: Remediation Task Creation

Create a remediation task in the execution graph with the root cause analysis attached.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "RCA Remediation — <root cause>", priority: "critical")
```

Include in the task description:
- Root cause summary (one sentence)
- Causal chain (symptom -> intermediate -> root cause)
- Evidence supporting the conclusion
- Recommended remediation steps
- Prevention recommendations (how to avoid recurrence)

### Step 9: Record Analysis

Save the complete root cause analysis for future pattern matching and post-incident review.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Root Cause Analysis — <incident> <date>"
  content: "<symptoms, causal chain, root cause, evidence, remediation, prevention recommendations, model accuracy>"
  tags: ["aiops", "rca", "root-cause", "incident"]
```

## Output Format

```
Phase: ROOT CAUSE ANALYSIS
Incident: <incident description>
Duration: <symptom start> to <resolution/current>

Symptoms Collected: <N>
Signals Correlated: <N>
Dependency Graph: <N> services, <N> edges

Root Cause Candidates:
  1. <service/component> — score: <N> — <one-line explanation>
  2. <service/component> — score: <N> — <one-line explanation>
  3. <service/component> — score: <N> — <one-line explanation>

Causal Chain:
  <root cause> --> <intermediate 1> --> <intermediate 2> --> <symptom>

Historical Match: <matched/no match> (similarity: <N>%)
Validation: <confirmed/needs investigation>

Remediation Task: <node ID> — <title>
MTTR Impact: estimated <N> minutes saved vs manual triage
Saved to memory: "Root Cause Analysis — <incident> <date>"
```

## Anti-Patterns

- Do NOT confuse correlation with causation -- temporal correlation alone is insufficient; validate with dependency graph and counterfactual analysis
- Do NOT stop at the first plausible cause -- always score and rank multiple candidates to avoid confirmation bias
- Do NOT ignore infrastructure-level signals -- many application-layer symptoms have infrastructure root causes (disk, network, DNS)
- Do NOT skip historical pattern matching -- past incidents provide the strongest signal for recurring failure modes
- Do NOT present symptoms as root causes -- "high latency" is a symptom, "connection pool exhaustion due to leaked connections" is a root cause
- Do NOT assume a single root cause -- complex incidents can have multiple independent contributing causes
- Do NOT skip writing the analysis to memory -- root cause patterns are the most valuable knowledge for reducing future MTTR
