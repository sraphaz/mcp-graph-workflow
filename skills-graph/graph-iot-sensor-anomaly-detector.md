---
name: graph-iot-sensor-anomaly-detector
description: Anomaly detection in sensor readings using Isolation Forest and statistical methods
triggers:
  - graph-iot-sensor-anomaly-detector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-anomaly-detector

Orchestrates anomaly detection across IoT sensor streams using a combination of statistical methods and machine learning (Isolation Forest). Identifies outliers, drift, and abnormal patterns in real-time and batch modes, enabling proactive alerting and root cause investigation.

## When to Use

- When sensor readings exhibit unexpected spikes, drops, or drift that need automatic detection
- When deploying Isolation Forest models for unsupervised anomaly scoring on multivariate sensor data
- When combining statistical baselines (z-score, IQR) with ML-based detection for layered anomaly coverage
- When building an anomaly alerting pipeline that triggers graph events on detection
- When analyzing historical sensor data to identify recurring anomaly patterns
- When tuning detection sensitivity to balance false positives against missed anomalies

## Mandatory Flow

```
search(anomaly detection nodes) → node(add anomaly detector task) → analyze(tdd_check) → implement detection with TDD → metrics(detection accuracy) → write_memory(model parameters) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Assess Existing Detection Infrastructure

Search the graph for existing anomaly detection nodes, alerting rules, or statistical baseline computations.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Identify gaps in current detection coverage

### Step 2: Create Anomaly Detection Task Nodes

Add task nodes for each detection layer: statistical baseline, Isolation Forest model, alert dispatcher, and feedback loop.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: precision >= 0.85, recall >= 0.80, latency < 50ms per evaluation

### Step 3: Implement Statistical Baseline Detection

Build the first detection layer using lightweight statistical methods:

- **Z-score detector:** Flag readings beyond configurable sigma threshold (default: 3 sigma)
- **IQR detector:** Flag readings outside Q1 - 1.5*IQR to Q3 + 1.5*IQR range
- **CUSUM detector:** Cumulative sum control chart for detecting persistent drift
- **Seasonal decomposition:** Subtract expected seasonal pattern before anomaly scoring

These run on every incoming reading with near-zero latency and serve as the fast-path filter.

### Step 4: Implement Isolation Forest Model

Build the ML-based detection layer using Isolation Forest for multivariate anomaly scoring:

- **Feature engineering:** Derive features from sliding windows (mean, stddev, rate-of-change, FFT dominant frequency)
- **Model training:** Train on historical normal-operation data with contamination parameter tuned via validation set
- **Scoring pipeline:** Score each feature vector and classify as normal (score < threshold) or anomaly (score >= threshold)
- **Online adaptation:** Periodically retrain on recent data to adapt to concept drift

### Step 5: Implement Ensemble Scoring

Combine statistical and ML detectors into an ensemble score:

```
ensemble_score = w_stat * statistical_score + w_ml * isolation_forest_score
anomaly = ensemble_score >= dynamic_threshold
```

Dynamic threshold adapts based on time-of-day, day-of-week, and operational mode (startup, steady-state, shutdown).

### Step 6: Build Alert Dispatcher

Route detected anomalies to appropriate handlers based on severity and sensor type:

| Severity | Criteria | Action |
|----------|----------|--------|
| Critical | ensemble_score > 0.95 | Immediate alert + graph node creation |
| Warning | ensemble_score > 0.80 | Queued alert + dashboard notification |
| Info | ensemble_score > 0.65 | Log entry + metrics counter |

**Tool:** `mcp__mcp-graph__node`
- Action: `add` (create alert task nodes for critical anomalies)

### Step 7: Measure Detection Performance

Evaluate detection accuracy against labeled anomaly datasets and operational metrics.

**Tool:** `mcp__mcp-graph__metrics`
- Track: precision, recall, F1-score, false positive rate, detection latency, model inference time
- Compare against acceptance criteria thresholds

### Step 8: Validate End-to-End Detection Pipeline

Run integration tests with synthetic anomaly injection to verify the full pipeline from ingestion through detection to alerting.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify detection accuracy, latency SLA, and alert routing correctness

### Step 9: Record Model Parameters and Decisions

Persist model hyperparameters, threshold calibration results, and detection strategy rationale.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: Isolation Forest parameters, ensemble weights, threshold calibration, retraining schedule

## Output Format

```yaml
anomaly_detection_report:
  detectors:
    statistical:
      z_score_threshold: 3.0
      iqr_multiplier: 1.5
      cusum_drift: 0.5
    isolation_forest:
      n_estimators: 200
      contamination: 0.02
      max_features: 8
      retrain_interval: "24h"
    ensemble:
      weight_statistical: 0.4
      weight_ml: 0.6
      dynamic_threshold: true
  performance:
    precision: 0.91
    recall: 0.87
    f1_score: 0.89
    false_positive_rate: 0.03
    avg_detection_latency_ms: 12.4
  alerts_generated:
    critical: 3
    warning: 17
    info: 142
  sensors_monitored: 48
  evaluation_window: "7d"
```

## Anti-Patterns

- Do NOT rely solely on static thresholds; sensor behavior varies by time-of-day and operational mode
- Do NOT train Isolation Forest on data that contains unlabeled anomalies; curate the training set
- Do NOT skip the statistical baseline layer; it catches obvious anomalies at near-zero cost
- Do NOT ignore concept drift; schedule periodic model retraining with recent normal-operation data
- Do NOT alert on every anomaly detection; implement severity classification and deduplication
- Do NOT evaluate detection accuracy without labeled ground truth; maintain an anomaly annotation dataset
- Do NOT deploy model updates without A/B comparison against the current production model
