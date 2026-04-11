---
name: graph-anomaly-detection-ml
description: Graph anomaly detection using Isolation Forest and Autoencoders to identify unusual tasks, latency spikes, and broken dependency patterns
triggers:
  - graph-anomaly-detection-ml
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-anomaly-detection-ml

Anomaly detection skill that applies Isolation Forest and Autoencoder models to execution graph data, identifying unusual task behaviors, latency spikes, broken dependency patterns, and structural irregularities. Operates continuously in the background to surface issues before they cascade.

## When to Use

- During IMPLEMENT phase -- detect tasks with abnormal cycle times or status transitions
- After bulk imports or PRD ingestion -- validate structural integrity of new graph regions
- When metrics show unexpected deviations -- automated root cause isolation
- During VALIDATE phase -- flag tasks that skipped required workflow steps
- On every `analyze(mode: "progress")` -- append anomaly context to status reports
- Proactively after dependency changes -- detect newly introduced cycles or orphans

## Mandatory Flow

```
extract graph features --> build normal behavior profile --> run isolation forest --> run autoencoder reconstruction --> score anomalies --> classify anomaly type --> generate alerts --> update nodes --> write_memory
```

## Workflow

### Step 1: Extract Graph Features

Collect multi-dimensional feature vectors from the execution graph:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__metrics (type: "cycle_time")
Tool: mcp__mcp-graph__search (query: "*", type: "task")
```

Build feature vectors per node:
| Feature | Description |
|---------|-------------|
| `cycle_time_hours` | Time from in_progress to done |
| `wait_time_hours` | Time from ready to in_progress |
| `status_transition_count` | Number of status changes |
| `dependency_in_degree` | Number of incoming edges |
| `dependency_out_degree` | Number of outgoing edges |
| `blocked_duration_hours` | Total time spent in blocked status |
| `description_length` | Character count of description |
| `ac_count` | Number of acceptance criteria |
| `reopen_count` | Times moved from done back to in_progress |
| `subtask_ratio` | Completed subtasks / total subtasks |
| `knowledge_hit_count` | RAG context matches for this node |

Build feature vectors per edge:
| Feature | Description |
|---------|-------------|
| `edge_weight` | Dependency strength |
| `source_status` | Status of source node |
| `target_status` | Status of target node |
| `cross_phase` | Whether edge spans lifecycle phases |

### Step 2: Build Normal Behavior Profile

Establish baseline distribution from completed, healthy tasks:

Filter training data:
- Only tasks with status `done` and valid status flow (ready -> in_progress -> done)
- Exclude tasks explicitly marked as outliers in previous runs
- Require minimum 20 completed tasks for reliable profiling

Compute per-feature statistics:
- Mean, standard deviation, median, IQR for each numeric feature
- Distribution shape (skewness, kurtosis) to detect non-Gaussian features
- Pairwise correlations to identify coupled features

Save profile:
```
Tool: mcp__mcp-graph__write_memory (title: "Anomaly Detection — Normal Profile", content: <feature statistics, correlation matrix>)
```

### Step 3: Run Isolation Forest

Apply Isolation Forest for point anomaly detection:

- **Algorithm**: Randomly partition feature space; anomalies require fewer splits to isolate
- **Hyperparameters**: `n_estimators=100, contamination=0.05, max_samples=256`
- **Input**: Feature matrix from Step 1 (all active and recently completed tasks)
- **Output**: Anomaly score per node (-1 = anomaly, 1 = normal, continuous score in [0, 1])

Isolation Forest is effective for:
- Tasks with extreme cycle times (very fast or very slow)
- Tasks with unusual dependency patterns (too many or too few)
- Tasks that were reopened multiple times
- Tasks with zero knowledge coverage despite high complexity

### Step 4: Run Autoencoder Reconstruction

Apply a shallow Autoencoder for structural anomaly detection:

- **Architecture**: Input(N) -> Dense(N/2) -> Dense(N/4) -> Dense(N/2) -> Output(N)
- **Training**: On normal profile data only (semi-supervised)
- **Loss**: Mean Squared Error (MSE) between input and reconstruction
- **Anomaly threshold**: Reconstruction error > 2 standard deviations above mean

Autoencoder detects:
- Subtle multi-feature anomalies that Isolation Forest misses
- Tasks where the combination of features is unusual (even if each feature alone is normal)
- Structural patterns in dependency graphs that deviate from project norms
- Gradual drift in task characteristics over time

### Step 5: Score and Rank Anomalies

Combine scores from both models into a unified anomaly score:

```
unified_score = 0.5 * isolation_forest_score + 0.5 * autoencoder_reconstruction_error_normalized
```

Classify severity:
| Score Range | Severity | Action |
|-------------|----------|--------|
| 0.0 - 0.3 | Normal | No action |
| 0.3 - 0.6 | Watch | Log for trend monitoring |
| 0.6 - 0.8 | Warning | Flag in next `analyze` report |
| 0.8 - 1.0 | Critical | Immediate alert, recommend investigation |

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 6: Classify Anomaly Type

For each detected anomaly (score > 0.6), determine the anomaly category:

| Type | Detection Signal | Recommended Action |
|------|-----------------|-------------------|
| **Duration spike** | cycle_time > 3x median | Decompose task, check blockers |
| **Dependency anomaly** | in_degree or out_degree > P95 | Review dependency structure |
| **Status thrashing** | status_transition_count > 5 | Investigate unclear requirements |
| **Orphan task** | in_degree=0, out_degree=0 | Link to parent epic or remove |
| **Stale blocked** | blocked_duration > 48h | Escalate or re-assign blocker |
| **Knowledge gap** | knowledge_hit_count=0, high complexity | Run rag_context, sync docs |
| **Regression** | Previously done task moved back | Review AC, check what broke |

```
Tool: mcp__mcp-graph__node (action: "show", nodeId: <anomalous_node>)
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

### Step 7: Generate Alerts and Update Graph

For critical anomalies, update the graph with findings:

```
Tool: mcp__mcp-graph__node (action: "update", nodeId: <id>, metadata: { anomaly_score, anomaly_type, detection_date })
```

For structural anomalies (cycles, orphans, broken dependencies):
```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

### Step 8: Persist Detection Results

Save the full anomaly detection report:

```
Tool: mcp__mcp-graph__write_memory (title: "Anomaly Detection Report — <date>", content: <anomalies, scores, types, recommendations>)
```

Include model performance data for calibration: false positive rate, detection latency, feature importance from Isolation Forest.

## Output Format

```
Phase: ANOMALY DETECTION
Nodes Scanned: <N> total (<N> active, <N> completed)
Normal Profile: <N> features, <N> training samples
Anomalies Detected: <N> total
  Critical (<N>):
    - <node_id>: <anomaly_type>, score=<N>, <description>
  Warning (<N>):
    - <node_id>: <anomaly_type>, score=<N>, <description>
  Watch (<N>):
    - <node_id>: <anomaly_type>, score=<N>, <description>
Structural Issues: <N> orphans, <N> cycles, <N> broken edges
Model Health: IF precision=<N>%, AE reconstruction_loss=<N>
Recommendations: <top 3 actions>

Saved to memory: "Anomaly Detection Report — <date>"
```

## Anti-Patterns

- Do NOT set contamination rate too high -- 5% is a reasonable default; higher rates produce excessive false positives
- Do NOT train on anomalous data -- filter the training set to known-good tasks only
- Do NOT alert on every anomaly -- use severity thresholds to avoid alert fatigue
- Do NOT ignore structural anomalies -- orphan tasks and dependency cycles are bugs, not noise
- Do NOT run detection without sufficient data -- minimum 20 completed tasks for reliable profiling
- Do NOT treat anomaly scores as binary -- use the continuous score for nuanced prioritization
- Do NOT skip false positive review -- periodically review detected anomalies and mark false positives to improve the model
