---
name: graph-time-series-ml-forecaster
description: Time series forecasting for graph load, scalability prediction, and resource planning using statistical and ML ensemble models
triggers:
  - graph-time-series-ml-forecaster
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-time-series-ml-forecaster

Time series ML forecasting skill that predicts future graph load, database scalability requirements, API throughput, RAG pipeline latency, and knowledge store growth. Integrates with AutoScalability and ProactiveMonitoring skills to provide data-driven capacity planning and early warning of performance degradation.

## When to Use

- Before scaling decisions -- predict when the graph database will hit performance thresholds
- During PLAN phase -- forecast sprint-level resource needs based on projected graph growth
- When latency trends upward -- predict when response times will breach SLA thresholds
- For capacity planning -- forecast knowledge store size, embedding index growth, and disk usage
- After infrastructure changes -- validate that improvements will sustain projected load
- Proactively on weekly cadence -- generate rolling 30-day forecasts for key metrics

## Mandatory Flow

```
collect time series data --> preprocess and decompose --> fit statistical models --> fit ML models --> ensemble predictions --> detect change points --> generate forecasts --> alert on threshold crossings --> write_memory
```

## Workflow

### Step 1: Collect Time Series Data

Gather historical metric data from the graph system:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__metrics (type: "cycle_time")
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

Time series to track:
| Series | Source | Frequency | Unit |
|--------|--------|-----------|------|
| `graph_node_count` | SQLite row count | Daily | Count |
| `graph_edge_count` | SQLite row count | Daily | Count |
| `knowledge_store_size` | Knowledge stats | Daily | MB |
| `rag_query_latency_p95` | RAG trace logs | Hourly | ms |
| `api_response_time_p95` | API metrics | Hourly | ms |
| `tasks_completed_daily` | Metrics velocity | Daily | Count |
| `sprint_velocity` | Metrics velocity | Per sprint | Points |
| `embedding_index_size` | Embedding store | Daily | MB |
| `fts_index_size` | FTS5 stats | Daily | MB |
| `concurrent_tool_calls` | MCP metrics | Hourly | Count |

Minimum history: 14 data points for daily series, 30 for hourly series.

### Step 2: Preprocess and Decompose

Clean and decompose each time series:

**Preprocessing:**
- Handle missing values: linear interpolation for gaps < 3 periods, forward-fill for longer gaps
- Outlier detection: IQR method, replace outliers with windowed median
- Normalize: Z-score normalization per series (preserve original scale for reporting)

**Decomposition (STL):**
- Trend: LOESS smoothing with bandwidth proportional to series length
- Seasonal: extract weekly patterns (daily data) or daily patterns (hourly data)
- Residual: what remains after removing trend and seasonality

Flag series with:
- Strong trend (trend variance > 50% of total variance): likely needs capacity planning
- Strong seasonality (seasonal variance > 20%): schedule resource allocation by pattern
- High residual (residual variance > 40%): noisy, widen confidence intervals

### Step 3: Fit Statistical Models

Apply classical time series models as the baseline ensemble:

**ARIMA / Auto-ARIMA:**
- Automatic order selection via AIC: `(p, d, q)` search up to `(5, 2, 5)`
- Seasonal ARIMA for series with detected seasonality: `(P, D, Q, S)`
- Validation: rolling-origin forecast on last 20% of data

**Exponential Smoothing (ETS):**
- Automatic model selection: additive/multiplicative error, trend, seasonality
- Damped trend option for series showing saturation
- Point forecast + prediction intervals (80%, 95%)

**Prophet (for daily+ series):**
- Changepoint detection with `changepoint_prior_scale=0.05`
- Custom seasonalities: weekly, sprint-cycle
- Regressor: known future events (sprint boundaries, release dates)

### Step 4: Fit ML Models

Apply ML models for non-linear pattern capture:

**LightGBM with lag features:**
- Features: `lag_1, lag_7, lag_14, rolling_mean_7, rolling_std_7, day_of_week, month`
- Direct multi-step forecasting: separate model per horizon step
- Hyperparameters: `num_leaves=31, learning_rate=0.05, n_estimators=200`

**1D-CNN for pattern recognition:**
- Architecture: Conv1D(filters=32, kernel=3) -> MaxPool -> Conv1D(16, 3) -> Dense(horizon)
- Input: sliding window of length 14
- Training: last 80% of data, validation on remaining 20%

Both models produce point forecasts. Confidence intervals derived from residual distribution.

### Step 5: Ensemble Predictions

Combine models using weighted averaging:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Ensemble strategy:
- Compute validation RMSE for each model on holdout set
- Weight inversely proportional to RMSE: `w_i = (1/RMSE_i) / sum(1/RMSE_j)`
- Final forecast: `y_hat = sum(w_i * y_hat_i)`
- Confidence interval: union of individual model intervals (conservative)

Model selection fallback:
- If one model clearly dominates (>30% better RMSE), use it alone
- If all models are close (<5% RMSE difference), equal weighting

### Step 6: Detect Change Points

Identify structural breaks in time series that invalidate historical patterns:

**PELT (Pruned Exact Linear Time) algorithm:**
- Detect shifts in mean and/or variance
- Penalty: BIC to avoid over-segmentation
- Minimum segment length: 7 data points

Change point interpretation:
| Type | Signal | Action |
|------|--------|--------|
| Mean shift up | Sustained load increase | Revise capacity plan |
| Mean shift down | Load reduction (optimization worked) | Update baseline |
| Variance increase | System becoming unstable | Investigate root cause |
| Trend break | Growth rate changed | Retrain models with post-break data only |

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 7: Generate Forecasts and Threshold Alerts

Produce rolling forecasts with actionable alerts:

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

For each time series, forecast:
- **7-day horizon**: high confidence (narrow intervals)
- **30-day horizon**: medium confidence
- **90-day horizon**: directional only (wide intervals)

Threshold crossing alerts:
| Metric | Warning Threshold | Critical Threshold | Forecast Breach |
|--------|-------------------|-------------------|-----------------|
| `rag_query_latency_p95` | 500ms | 1000ms | Date when P50 forecast crosses |
| `knowledge_store_size` | 500MB | 1GB | Date when P50 forecast crosses |
| `graph_node_count` | 5000 | 10000 | Date when P50 forecast crosses |
| `api_response_time_p95` | 200ms | 500ms | Date when P50 forecast crosses |

### Step 8: Persist Forecasts

Save all forecasts and alerts:

```
Tool: mcp__mcp-graph__write_memory (title: "Time Series Forecast — <date>", content: <forecasts, alerts, model weights, change points>)
```

Include forecast accuracy from previous predictions (predicted vs actual) for model calibration tracking.

## Output Format

```
Phase: TIME SERIES FORECASTING
Series Analyzed: <N>
Forecast Horizons: 7d, 30d, 90d
Model Ensemble: <model_1> (w=<N>), <model_2> (w=<N>), <model_3> (w=<N>)
Validation RMSE: <N> (ensemble), <N> (best single model)

Key Forecasts (30-day):
  graph_node_count: <current> -> <forecast> (CI: <low>-<high>)
  knowledge_store_size: <current>MB -> <forecast>MB
  rag_query_latency_p95: <current>ms -> <forecast>ms
  sprint_velocity: <current> -> <forecast> tasks/sprint

Threshold Alerts:
  - <metric>: WARNING threshold (<N>) breached in <N> days (P50)
  - <metric>: CRITICAL threshold (<N>) breached in <N> days (P80)

Change Points Detected: <N>
  - <series> at <date>: <type> (<description>)

Previous Forecast Accuracy: MAPE=<N>%, coverage=<N>% (95% CI)

Saved to memory: "Time Series Forecast — <date>"
```

## Anti-Patterns

- Do NOT forecast without decomposition -- raw series miss trend vs seasonality distinction
- Do NOT use a single model -- ensembles consistently outperform individual models on diverse series
- Do NOT ignore change points -- forecasting across a structural break produces garbage predictions
- Do NOT forecast beyond 3x the training data length -- long-horizon forecasts are unreliable
- Do NOT set thresholds without historical context -- thresholds should reflect actual system limits
- Do NOT skip forecast calibration -- compare past predictions with actuals to measure drift
- Do NOT treat forecasts as deterministic -- always present confidence intervals, never just point estimates
