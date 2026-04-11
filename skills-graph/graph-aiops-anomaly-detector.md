---
name: graph-aiops-anomaly-detector
description: ML-powered anomaly detection in metrics, logs, and traces using Isolation Forest, Autoencoders, and statistical methods for proactive incident prevention
triggers:
  - graph-aiops-anomaly-detector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-aiops-anomaly-detector

ML-powered anomaly detection across metrics, logs, and traces. Combines Isolation Forest for point anomalies, Autoencoders for multivariate pattern anomalies, and statistical methods (Z-score, MAD, Grubbs) for real-time threshold-free alerting. Proactively identifies abnormal behavior before it escalates into incidents.

## When to Use

- When metrics show unexpected patterns that static thresholds would miss
- When log volumes or error rates deviate from historical baselines
- When trace latency distributions shift without an obvious deployment cause
- When setting up proactive monitoring that adapts to seasonal and trend patterns
- When investigating whether a metric change is a real anomaly or normal variance
- When onboarding new services that lack historical threshold definitions

## Mandatory Flow

```
collect(metrics + logs + traces) --> baseline(build normal model) --> detect(run ML models) --> classify(score + rank) --> correlate(cross-signal) --> alert(notify) --> node(create incident task) --> analyze(impact) --> write_memory
```

## Workflow

### Step 1: Data Collection and Ingestion

Gather telemetry data from all three observability pillars. Normalize into a common time-series format for ML processing.

```
Tool: mcp__mcp-graph__metrics (scope: "all", timeRange: "24h")
```

Data sources and normalization:

| Signal | Source | Normalization |
|--------|--------|---------------|
| Metrics | Prometheus, CloudWatch, custom counters | Align to 1-minute intervals, fill gaps with interpolation |
| Logs | Structured JSON logs, syslog | Extract numeric fields (count, duration, size), aggregate per interval |
| Traces | OpenTelemetry spans, Jaeger | Compute per-service latency percentiles (P50, P95, P99) per interval |

Handle missing data: forward-fill for gaps < 5 minutes, mark as missing for longer gaps. Never interpolate across deployment boundaries.

### Step 2: Baseline Model Construction

Build a model of "normal" behavior from historical data. The baseline adapts to seasonality (hourly, daily, weekly patterns) and trend (growth over time).

Statistical baseline:
- **Rolling mean + standard deviation** -- 7-day rolling window, recomputed hourly
- **Seasonal decomposition** -- STL decomposition to separate trend, seasonal, and residual components
- **MAD (Median Absolute Deviation)** -- robust alternative to standard deviation, resistant to outliers

ML baseline:
- **Isolation Forest** -- train on 14-day historical data, contamination parameter 0.01 (1% expected anomaly rate)
- **Autoencoder** -- train on 30-day historical data, reconstruction error as anomaly score

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 3: Anomaly Detection Execution

Run all detection models in parallel against incoming telemetry data. Each model produces an anomaly score per data point.

Detection ensemble:

| Model | Strength | Best For |
|-------|----------|----------|
| Z-score | Simple, fast, interpretable | Single-metric point anomalies with Gaussian distribution |
| MAD | Robust to existing outliers | Metrics with fat tails or existing noise |
| Grubbs test | Statistical rigor | Confirming whether a single outlier is statistically significant |
| Isolation Forest | No distribution assumption | Multivariate anomalies, mixed metric types |
| Autoencoder | Pattern-level detection | Complex multi-metric correlations, subtle drift |

Ensemble scoring: each model votes (anomaly/normal), final score = weighted vote count. Weights based on historical accuracy per metric type.

### Step 4: Classification and Scoring

Classify detected anomalies by type, severity, and confidence.

Anomaly types:
- **Point anomaly** -- single data point deviates from the series (spike, drop)
- **Contextual anomaly** -- value is normal globally but abnormal in its specific context (e.g., high traffic at 3 AM)
- **Collective anomaly** -- a sequence of data points is abnormal as a group (sustained drift, oscillation)

Severity scoring:

| Score | Level | Criteria |
|-------|-------|----------|
| 0.9 - 1.0 | Critical | >5 sigma deviation, all models agree, affects SLO |
| 0.7 - 0.89 | High | >3 sigma, majority models agree |
| 0.5 - 0.69 | Medium | >2 sigma, some models agree |
| 0.3 - 0.49 | Low | >1.5 sigma, one model flags |
| < 0.3 | Info | Statistical noise, log only |

### Step 5: Cross-Signal Correlation

Correlate anomalies across metrics, logs, and traces to identify related incidents. A CPU spike that correlates with increased error logs and trace latency is one incident, not three.

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Correlation methods:
- **Temporal proximity** -- anomalies within a 5-minute window across signals
- **Causal graph** -- known dependency relationships (service A calls service B)
- **Granger causality** -- statistical test for whether one time series predicts another
- **Common labels** -- shared metadata (service name, host, deployment ID)

Group correlated anomalies into incident clusters. Each cluster gets a single incident score (max severity of constituent anomalies).

### Step 6: Alert and Task Creation

For anomalies above the alert threshold, create incident task nodes in the execution graph.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Anomaly Incident — <service> <anomaly_type>", priority: "<severity>")
```

Alert enrichment:
- Affected service and metric names
- Anomaly type and severity score
- Historical context (has this happened before? when? what was the resolution?)
- Correlated signals (which other metrics/logs/traces show related anomalies?)
- Suggested investigation starting point

### Step 7: Record Findings and Model Performance

Save detection results and update model performance tracking.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Anomaly Detection Report — <date>"
  content: "<anomalies detected, severity distribution, correlation clusters, model accuracy, false positive rate, recommended threshold adjustments>"
  tags: ["aiops", "anomaly-detection", "ml", "observability"]
```

Track model performance over time:
- False positive rate per model (target: < 5%)
- Detection latency (time from anomaly occurrence to detection)
- Miss rate (anomalies found by humans but missed by models)
- Ensemble weight adjustments based on accuracy

## Output Format

```
Phase: AIOPS ANOMALY DETECTION
Time Range: <start> to <end>
Data Points Analyzed: <N>

Anomalies Detected:
  Total: <N>
  Critical: <N>
  High: <N>
  Medium: <N>
  Low: <N>

Correlation Clusters: <N> incidents from <N> raw anomalies

Model Performance:
  Isolation Forest: <N> detections, <N>% confidence
  Autoencoder: <N> detections, <N>% confidence
  Statistical (Z/MAD/Grubbs): <N> detections

Top Anomalies:
  1. <service> — <metric> — <type> — severity <score>
  2. <service> — <metric> — <type> — severity <score>
  3. <service> — <metric> — <type> — severity <score>

Tasks Created: <N>
Saved to memory: "Anomaly Detection Report — <date>"
```

## Anti-Patterns

- Do NOT rely on static thresholds alone -- ML models adapt to seasonal and trend patterns that static thresholds cannot
- Do NOT train models on data that includes known incidents -- contaminated training data normalizes abnormal behavior
- Do NOT alert on every low-severity anomaly -- alert fatigue degrades response quality; only alert on medium+ severity
- Do NOT ignore cross-signal correlation -- treating each metric independently generates duplicate and misleading alerts
- Do NOT skip baseline recalibration after deployments -- new deployments shift normal behavior patterns
- Do NOT use a single ML model in isolation -- ensemble methods significantly reduce false positive rates
- Do NOT deploy anomaly detection without a feedback loop -- false positive/negative tracking is essential for model improvement
