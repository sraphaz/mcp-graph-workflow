---
name: graph-iot-sensor-predictive-maintenance
description: Predictive maintenance from sensor history using failure prediction and remaining useful life estimation
triggers:
  - graph-iot-sensor-predictive-maintenance
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-predictive-maintenance

Orchestrates predictive maintenance workflows that analyze historical sensor data to forecast equipment failures, estimate remaining useful life (RUL), and schedule proactive maintenance tasks in the execution graph. Shifts maintenance strategy from reactive or calendar-based to condition-based and predictive.

## When to Use

- When equipment failures are costly and sensor data can provide early warning indicators
- When building remaining useful life (RUL) estimation models from vibration, temperature, or current sensors
- When scheduling maintenance tasks proactively based on predicted failure windows
- When analyzing failure history to identify degradation signatures and leading indicators
- When optimizing maintenance intervals to minimize both downtime and unnecessary servicing
- When creating maintenance forecast nodes in the execution graph for resource planning

## Mandatory Flow

```
search(maintenance nodes) → node(add predictive maintenance task) → forecast(failure probability) → metrics(model accuracy) → analyze(implement_done) → write_memory(model parameters + maintenance policy) → node(add scheduled maintenance tasks) → update_status(done)
```

## Workflow

### Step 1: Assess Current Maintenance Strategy

Search the graph for existing maintenance nodes, failure records, and sensor-based monitoring to understand the baseline.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Identify: current maintenance frequency, unplanned downtime rate, sensor coverage gaps

### Step 2: Create Predictive Maintenance Task Nodes

Add task nodes for each stage: feature engineering, model training, RUL estimation, maintenance scheduling, and feedback loop.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: RUL accuracy within 10% of actual, false alarm rate < 5%, lead time >= 7 days

### Step 3: Build Degradation Feature Engineering

Extract degradation-indicative features from raw sensor streams:

- **Vibration features:** RMS amplitude, peak frequency shift, crest factor, kurtosis, spectral entropy
- **Temperature features:** Baseline drift, thermal cycling count, rate of rise under load
- **Current/power features:** Power factor degradation, harmonic distortion increase, startup current trend
- **Operational features:** Cumulative operating hours, load cycles, environmental stress (humidity, dust)

Features are computed over configurable windows (1h, 8h, 24h, 7d) to capture both short-term events and long-term trends.

### Step 4: Train Failure Prediction Model

Build and train the predictive model using historical run-to-failure data:

- **Survival analysis:** Cox proportional hazards model for time-to-event prediction with sensor covariates
- **Regression RUL:** Gradient boosted regression mapping feature trajectories to remaining useful life
- **Classification:** Binary classifier for "will fail within N days" using recent feature windows
- **Ensemble:** Weighted combination of survival + regression + classification for robust RUL estimate

### Step 5: Generate Failure Forecasts

Run the trained model against current sensor data to produce failure probability forecasts.

**Tool:** `mcp__mcp-graph__forecast`
- Input: current sensor features for each monitored asset
- Output: failure probability curve, estimated RUL, confidence interval
- Horizon: 30-day rolling forecast updated daily

### Step 6: Schedule Proactive Maintenance Tasks

Convert failure forecasts into maintenance task nodes in the execution graph, scheduled within the predicted safe maintenance window.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Title: "Preventive maintenance: {asset_name} - predicted failure in {N} days"
- Priority: derived from failure probability and asset criticality
- Due date: calculated as RUL minus safety margin

### Step 7: Measure Model Performance

Track prediction accuracy against actual failure events to continuously calibrate the model.

**Tool:** `mcp__mcp-graph__metrics`
- Track: RUL prediction error (MAE, RMSE), failure prediction precision/recall, false alarm rate, lead time distribution
- Compare against acceptance criteria

### Step 8: Implement Feedback Loop

When actual failures or maintenance events occur, feed outcomes back into the model:

- Update training dataset with new run-to-failure sequences
- Recalibrate survival curves with observed failure times
- Adjust confidence intervals based on prediction vs actual comparison
- Update maintenance policy thresholds based on accumulated evidence

### Step 9: Validate Predictive Maintenance Pipeline

Run analysis to confirm the full pipeline from sensor ingestion through prediction to task scheduling.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: RUL accuracy, forecast generation, maintenance node creation, feedback loop operation

### Step 10: Record Maintenance Strategy Decisions

Persist model parameters, maintenance scheduling policy, and calibration results.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `operations`
- Content: model hyperparameters, RUL thresholds, maintenance window calculation, feedback loop schedule

## Output Format

```yaml
predictive_maintenance_report:
  assets_monitored: 24
  model:
    type: ensemble
    components: [survival_analysis, gradient_boost_rul, binary_classifier]
    training_samples: 1847
    last_retrain: "2026-04-09"
  predictions:
    - asset: "compressor_A1"
      rul_days: 18
      confidence_interval: [14, 23]
      failure_probability_7d: 0.12
      failure_probability_30d: 0.78
      recommended_action: "schedule_maintenance"
    - asset: "pump_B3"
      rul_days: 45
      confidence_interval: [38, 55]
      failure_probability_7d: 0.02
      failure_probability_30d: 0.15
      recommended_action: "monitor"
  maintenance_scheduled:
    tasks_created: 3
    earliest_due: "2026-04-22"
    latest_due: "2026-05-01"
  model_performance:
    rul_mae_days: 3.2
    rul_rmse_days: 4.8
    failure_prediction_precision: 0.89
    failure_prediction_recall: 0.83
    false_alarm_rate: 0.04
    avg_lead_time_days: 12.5
  cost_savings:
    unplanned_downtime_reduction: "62%"
    maintenance_cost_reduction: "28%"
```

## Anti-Patterns

- Do NOT rely on calendar-based maintenance when sensor data is available; it either over-maintains or under-maintains
- Do NOT train failure prediction models on normal-only data without any run-to-failure examples
- Do NOT ignore confidence intervals; always schedule maintenance based on the lower bound of the RUL estimate
- Do NOT skip the feedback loop; models degrade without continuous calibration against actual outcomes
- Do NOT create maintenance tasks without a safety margin; account for scheduling lead time and parts availability
- Do NOT treat all assets identically; criticality-weighted prioritization ensures high-impact assets get earlier attention
- Do NOT deploy predictive models without parallel running against the existing maintenance schedule for validation
