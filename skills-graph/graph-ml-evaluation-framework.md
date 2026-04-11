---
name: graph-ml-evaluation-framework
description: Comprehensive ML skill evaluation framework measuring MAE, F1, silhouette score, drift detection, and cross-skill performance benchmarking
triggers:
  - graph-ml-evaluation-framework
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-ml-evaluation-framework

ML evaluation framework that provides standardized, rigorous performance assessment for all ML skills in the graph ecosystem. Measures regression accuracy (MAE, RMSE, MAPE), classification quality (F1, Precision, Recall, AUC-ROC), clustering validity (silhouette score, Calinski-Harabasz), and system health (drift detection, calibration, fairness). Enables cross-skill benchmarking and continuous quality assurance.

## When to Use

- After any ML skill completes training -- evaluate before deployment approval
- During VALIDATE phase -- comprehensive quality gate for all active ML skills
- When prediction quality is questioned -- systematic diagnosis of model performance
- On weekly cadence -- automated evaluation of all active models for drift and degradation
- Before hyperparameter tuning -- establish baselines for comparison
- After model registry changes -- verify that promoted models maintain expected quality

## Mandatory Flow

```
collect predictions and actuals --> compute task-specific metrics --> run calibration analysis --> detect drift --> benchmark against baselines --> cross-skill comparison --> generate evaluation report --> flag failing models --> write_memory
```

## Workflow

### Step 1: Collect Predictions and Ground Truth

Gather prediction logs and corresponding actual outcomes for all active ML skills:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__metrics (type: "cycle_time")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Data collection per skill:
| Skill | Prediction | Ground Truth |
|-------|-----------|--------------|
| Predictive Analytics | Predicted duration (hours) | Actual cycle_time |
| Anomaly Detection | Anomaly score (0-1) | Human-labeled anomaly (0/1) |
| RL Optimizer | Recommended action | Actual reward received |
| Graph Embeddings | Predicted edges | Edge exists (0/1) |
| AutoML Pipeline | Task-specific prediction | Task-specific actual |
| Time Series Forecaster | Forecasted metric value | Actual metric value |
| Code Optimizer | Bug probability | Bug-fix commit occurred (0/1) |

Minimum evaluation sample: 30 prediction-actual pairs per skill. Flag skills with insufficient data.

### Step 2: Compute Task-Specific Metrics

Apply the appropriate metric suite based on ML task type:

**Regression Metrics (duration prediction, effort estimation, forecasting):**
| Metric | Formula | Interpretation |
|--------|---------|----------------|
| MAE | mean(abs(predicted - actual)) | Average absolute error in original units |
| RMSE | sqrt(mean((predicted - actual)^2)) | Penalizes large errors more |
| MAPE | mean(abs((actual - predicted) / actual)) * 100 | Percentage error, scale-independent |
| R2 | 1 - SS_res / SS_tot | Explained variance (1.0 = perfect) |
| Bias | mean(predicted - actual) | Systematic over/under-prediction |

**Classification Metrics (risk prediction, anomaly detection, bug prediction):**
| Metric | Formula | Interpretation |
|--------|---------|----------------|
| F1 (macro) | 2 * (P * R) / (P + R) | Harmonic mean of precision and recall |
| Precision | TP / (TP + FP) | How many positive predictions are correct |
| Recall | TP / (TP + FN) | How many actual positives are detected |
| AUC-ROC | Area under ROC curve | Discrimination ability across thresholds |
| MCC | Matthews Correlation Coefficient | Balanced metric for imbalanced classes |

**Clustering Metrics (task grouping, embedding clusters):**
| Metric | Range | Interpretation |
|--------|-------|----------------|
| Silhouette Score | [-1, 1] | Cohesion vs separation (>0.5 good) |
| Calinski-Harabasz | [0, inf) | Higher = better defined clusters |
| Davies-Bouldin | [0, inf) | Lower = better separated clusters |
| Noise Ratio | [0, 1] | Fraction of points not in any cluster |

**RL Metrics (optimizer performance):**
| Metric | Description |
|--------|-------------|
| Avg Reward | Mean cumulative reward per episode |
| Regret | Cumulative difference from optimal policy |
| Action Diversity | Entropy of action distribution |
| Improvement vs Baseline | % improvement over heuristic `next` |

### Step 3: Run Calibration Analysis

Assess whether model confidence scores are trustworthy:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

**Regression calibration:**
- For each confidence level (50%, 80%, 95%), check what fraction of actuals fall within the predicted interval
- Expected: 50% of actuals in 50% CI, 80% in 80% CI, 95% in 95% CI
- Calibration error: |expected_coverage - actual_coverage|
- Plot reliability diagram (expected vs observed coverage)

**Classification calibration:**
- Bin predictions by probability (0-0.1, 0.1-0.2, ..., 0.9-1.0)
- For each bin, compare mean predicted probability with actual positive rate
- Expected Calibration Error (ECE): weighted average of |predicted_prob - actual_rate| per bin
- Good calibration: ECE < 0.05

**Recalibration** (if needed):
- Regression: apply conformal prediction to adjust intervals
- Classification: apply Platt scaling or isotonic regression to recalibrate probabilities

### Step 4: Detect Model Drift

Identify when models are degrading over time:

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

Drift detection methods:
| Method | What It Detects | Trigger |
|--------|----------------|---------|
| **Page-Hinkley** | Gradual drift in prediction error | Cumulative sum exceeds threshold |
| **ADWIN** | Abrupt concept drift | Window comparison detects distribution change |
| **PSI** | Feature distribution shift | PSI > 0.2 for any input feature |
| **Performance decay** | Accuracy degradation over time | Rolling 30-prediction metric < threshold |

For each active model, compute:
- Rolling metric (window=30 predictions): current vs training metric
- Feature PSI: distribution of recent inputs vs training data
- Prediction PSI: distribution of recent outputs vs training outputs
- Time-to-threshold: at current degradation rate, when will metric breach minimum

Flag models with:
- Metric degradation > 10% from training performance
- Feature PSI > 0.2 on any feature
- Prediction PSI > 0.15

### Step 5: Benchmark Against Baselines

Compare each ML skill against non-ML baselines:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Baseline definitions:
| Skill | Baseline | Description |
|-------|----------|-------------|
| Predictive Analytics | Historical median | Predict median cycle_time for all tasks |
| Anomaly Detection | IQR rule | Flag points outside 1.5*IQR as anomalies |
| RL Optimizer | Heuristic `next` | Default priority-based task selection |
| Graph Embeddings | TF-IDF similarity | Text-only similarity without graph structure |
| AutoML Pipeline | Mean/mode predictor | Predict mean (regression) or mode (classification) |
| Time Series Forecaster | Naive forecast | Predict last observed value |
| Code Optimizer | LOC threshold | Flag files > 300 LOC as complex |

ML skill must beat its baseline by a statistically significant margin (p < 0.05, paired test) to justify its complexity and compute cost.

### Step 6: Cross-Skill Comparison

Generate a unified scorecard across all ML skills:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Normalized scoring (0-100 per skill):
| Score Component | Weight | Scoring |
|----------------|--------|---------|
| Primary metric | 40% | Percentile rank vs baseline |
| Calibration | 20% | 100 - (ECE * 1000) |
| Stability (no drift) | 20% | 100 if no drift, -20 per drift flag |
| Latency | 10% | 100 if < 50ms, linear decay |
| Coverage | 10% | % of inputs producing valid output |

Overall ML ecosystem health: weighted average of all skill scores.

### Step 7: Generate Evaluation Report

Compile the comprehensive evaluation:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Report structure:
- Executive summary: overall ML ecosystem health score
- Per-skill detailed metrics with pass/fail status
- Calibration analysis with reliability diagrams data
- Drift detection results with recommended actions
- Baseline comparison with statistical significance
- Cross-skill ranking

### Step 8: Flag Failing Models and Persist

Take action on underperforming models:

| Condition | Action |
|-----------|--------|
| Metric below minimum threshold | Flag for immediate retraining |
| Worse than baseline | Recommend deactivation pending investigation |
| Significant drift detected | Trigger incremental retraining |
| Poor calibration (ECE > 0.1) | Apply recalibration |
| All metrics healthy | Log and continue monitoring |

```
Tool: mcp__mcp-graph__write_memory (title: "ML Evaluation Report — <date>", content: <full report>)
```

Include actionable next steps for each flagged model.

## Output Format

```
Phase: ML EVALUATION FRAMEWORK
Models Evaluated: <N> active models across <N> ML skills
Evaluation Period: <start_date> to <end_date> (<N> predictions)

Overall ML Health Score: <N>/100

Per-Skill Results:
  Predictive Analytics: <PASS|WARN|FAIL> — MAE=<N>h, R2=<N>, calibration=<N>
  Anomaly Detection: <PASS|WARN|FAIL> — F1=<N>, AUC=<N>, precision=<N>
  RL Optimizer: <PASS|WARN|FAIL> — avg_reward=<N>, vs_baseline=+<N>%
  Graph Embeddings: <PASS|WARN|FAIL> — link_AUC=<N>, silhouette=<N>
  AutoML Pipeline: <PASS|WARN|FAIL> — <primary_metric>=<N>, vs_baseline=+<N>%
  Time Series Forecaster: <PASS|WARN|FAIL> — MAPE=<N>%, coverage_95=<N>%
  Code Optimizer: <PASS|WARN|FAIL> — bug_F1=<N>, precision=<N>

Drift Alerts: <N> models with detected drift
  - <model_id>: <drift_type>, severity=<low|medium|high>

Calibration: <N> well-calibrated, <N> need recalibration
Baseline Comparison: <N>/<N> skills beat their baseline (p<0.05)

Actions Required:
  - <model_id>: <retrain|deactivate|recalibrate|investigate>

Saved to memory: "ML Evaluation Report — <date>"
```

## Anti-Patterns

- Do NOT evaluate with fewer than 30 samples -- statistical tests require sufficient sample size for reliability
- Do NOT use accuracy alone for imbalanced classification -- F1, MCC, or AUC-ROC are far more informative
- Do NOT skip calibration checks -- a model that says "80% confident" should be right 80% of the time
- Do NOT ignore drift just because metrics look okay today -- drift compounds silently until sudden failure
- Do NOT compare models without statistical significance testing -- random variation can mimic real improvement
- Do NOT evaluate in isolation -- always compare against a simple baseline to justify ML complexity
- Do NOT treat the evaluation as a one-time event -- schedule recurring evaluations to catch degradation early
