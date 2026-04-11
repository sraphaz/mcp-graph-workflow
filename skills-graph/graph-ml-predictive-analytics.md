---
name: graph-ml-predictive-analytics
description: Task duration and risk prediction using time series models (Prophet, LightGBM) to forecast bottlenecks, phase drift, and completion dates
triggers:
  - graph-ml-predictive-analytics
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-ml-predictive-analytics

Predictive analytics skill that leverages local time series models (Prophet, LightGBM) to forecast task durations, sprint completion dates, risk probabilities, and phase drift. Proactively identifies bottlenecks before they materialize by analyzing historical graph execution data.

## When to Use

- Before PLAN phase -- predict sprint duration and realistic completion dates based on historical velocity
- During IMPLEMENT phase -- detect early signals of phase drift or schedule slippage
- When a task exceeds its estimated duration -- trigger re-forecasting of downstream dependencies
- After sprint completion -- calibrate models with actual vs predicted data for continuous improvement
- When planning resource allocation -- predict which tasks carry highest risk of delay
- Proactively on every `analyze(mode: "progress")` -- append prediction context to burndown reports

## Mandatory Flow

```
collect historical data --> feature engineering --> train/update models --> generate predictions --> detect anomalies/drift --> create risk report --> update graph nodes --> write_memory
```

## Workflow

### Step 1: Collect Historical Execution Data

Gather time series data from the execution graph for model training:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__metrics (type: "cycle_time")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Extract features from completed tasks:
- `cycle_time` = `done_timestamp - in_progress_timestamp` per task
- `lead_time` = `done_timestamp - created_at` per task
- Task complexity indicators: node type, dependency count, subtask count, description length
- Phase distribution: time spent in each status (ready, in_progress, blocked, done)
- Historical sprint velocity (tasks/day, story points/day)
- Day-of-week and time-of-day patterns in task completion

Minimum training data: 15 completed tasks. If fewer exist, use prior distributions with wide confidence intervals.

### Step 2: Feature Engineering

Transform raw graph data into ML-ready features:

| Feature | Source | Type |
|---------|--------|------|
| `dependency_depth` | Edge traversal from node | Numeric |
| `blocking_count` | Number of nodes this task blocks | Numeric |
| `subtask_count` | Child task count | Numeric |
| `description_tokens` | Token count of task description | Numeric |
| `ac_count` | Number of acceptance criteria | Numeric |
| `priority` | Node priority field | Categorical |
| `node_type` | task, epic, milestone | Categorical |
| `phase` | Current lifecycle phase | Categorical |
| `day_of_week` | Derived from created_at | Cyclical |
| `sprint_position` | Task order within sprint | Numeric |
| `knowledge_coverage` | RAG hits for task context | Numeric |

Encode categorical variables using target encoding for LightGBM and one-hot for Prophet regressors.

### Step 3: Train or Update Local Models

Train two complementary models locally (no external API calls):

**Prophet (time series forecasting):**
- Input: daily completion rate time series
- Regressors: sprint boundaries, phase transitions, team capacity changes
- Output: forecasted completion rate with uncertainty intervals (80%, 95%)
- Use multiplicative seasonality for weekly patterns

**LightGBM (task-level prediction):**
- Input: feature matrix from Step 2
- Target: task cycle_time in hours
- Hyperparameters: `num_leaves=31, learning_rate=0.05, n_estimators=200`
- Validation: 5-fold time-series split (never leak future data)
- Output: predicted duration per task + feature importance ranking

Save trained model artifacts:
```
Tool: mcp__mcp-graph__write_memory (title: "ML Model Artifacts — Predictive Analytics", content: <model metadata, feature importance, validation metrics>)
```

### Step 4: Generate Predictions

Run inference on all active (ready, in_progress) tasks:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For each active task, produce:
- **Predicted duration** (hours) with confidence interval
- **Predicted completion date** accounting for dependencies
- **Risk score** (0-100): probability of exceeding 2x estimated duration
- **Phase drift indicator**: current sprint on track / at risk / off track

Aggregate predictions into sprint-level forecast:
- Sprint completion date (P50, P80, P95)
- Number of tasks at risk of not completing in sprint
- Recommended scope adjustments if P80 exceeds sprint end

### Step 5: Detect Bottlenecks and Phase Drift

Compare predictions against plan:

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
Tool: mcp__mcp-graph__metrics (type: "burndown")
```

Flag the following conditions:
- **Bottleneck detected**: task with >3 downstream dependents predicted to exceed deadline
- **Phase drift**: cumulative predicted duration exceeds sprint capacity by >20%
- **Velocity decay**: rolling 5-task average cycle_time increasing by >30%
- **Blocked cascade**: blocked task predicted to remain blocked >24h based on blocker's prediction
- **Scope creep signal**: new tasks added mid-sprint pushing P80 past sprint end

### Step 6: Create Risk Report and Update Graph

Score and rank all risks:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For high-risk tasks (risk_score > 70), suggest mitigations:
- Decompose into smaller subtasks
- Re-prioritize to unblock downstream work
- Allocate to different sprint if non-critical
- Flag for pair programming or review

Update graph nodes with prediction metadata:
```
Tool: mcp__mcp-graph__node (action: "update", metadata: { predicted_duration, risk_score, confidence })
```

### Step 7: Persist Findings

Save the full prediction report and model performance metrics:

```
Tool: mcp__mcp-graph__write_memory (title: "Predictive Analytics Report — <date>", content: <predictions, risks, model accuracy, recommendations>)
```

Include model calibration data (predicted vs actual for recently completed tasks) to track model drift over time.

## Output Format

```
Phase: ML PREDICTIVE ANALYTICS
Data Points: <N> completed tasks, <N> active tasks
Model Accuracy: MAE=<N>h, MAPE=<N>%, R2=<N>
Sprint Forecast: P50=<date>, P80=<date>, P95=<date>
At-Risk Tasks: <N> (risk_score > 70)
  - <task_id>: predicted <N>h (CI: <N>-<N>h), risk=<N>/100
  - <task_id>: predicted <N>h (CI: <N>-<N>h), risk=<N>/100
Bottlenecks: <N> detected
  - <task_id>: blocks <N> downstream tasks, predicted late by <N>h
Phase Drift: <on_track | at_risk | off_track> (capacity utilization: <N>%)
Velocity Trend: <stable | improving | decaying> (rolling avg: <N>h/task)
Recommendations: <top 3 actions>

Saved to memory: "Predictive Analytics Report — <date>"
```

## Anti-Patterns

- Do NOT train models with fewer than 15 data points -- use prior distributions with wide confidence intervals instead
- Do NOT leak future data into training -- always use time-series split, never random split
- Do NOT ignore confidence intervals -- point predictions without uncertainty are misleading
- Do NOT retrain on every task completion -- batch retraining per sprint or on significant drift
- Do NOT use predictions to pressure teams -- predictions inform planning, not performance evaluation
- Do NOT skip model calibration -- compare predicted vs actual and track model accuracy over time
- Do NOT predict without feature importance -- unexplainable predictions erode trust in the system
