---
name: graph-predictive-alerting
description: Predictive time-series alerting that forecasts failures before they happen using statistical models and machine learning on observability data
triggers:
  - graph-predictive-alerting
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-predictive-alerting

Predictive time-series alerting that forecasts infrastructure and application failures before they happen. Uses statistical forecasting (Holt-Winters, ARIMA), machine learning (Prophet, LSTM), and capacity modeling to generate alerts hours or days before critical thresholds are breached. Shifts incident response from reactive firefighting to proactive prevention.

## When to Use

- When reactive alerting causes too many outages before teams can respond
- When capacity exhaustion (disk, memory, connections) is a recurring failure mode
- When SLA breaches need to be prevented rather than detected after the fact
- When planning maintenance windows based on predicted resource needs
- When reducing alert fatigue by replacing noisy threshold alerts with high-signal predictive alerts
- When seasonal traffic patterns make static thresholds unreliable

## Mandatory Flow

```
collect(historical time series) --> model(fit forecasting model) --> forecast(predict future values) --> threshold(define predictive alert rules) --> evaluate(check forecasts against thresholds) --> alert(notify before breach) --> node(create preventive task) --> metrics(track prediction accuracy) --> analyze(model performance) --> write_memory
```

## Workflow

### Step 1: Historical Data Collection

Gather historical time-series data for the metrics that will be forecast. Minimum 14 days of history for statistical models, 30+ days for ML models.

```
Tool: mcp__mcp-graph__metrics (scope: "time_series", timeRange: "30d")
```

Key metrics for predictive alerting:

| Metric | Failure Mode | Forecast Horizon |
|--------|-------------|-----------------|
| Disk usage (%) | Disk full, write failures | 7-30 days |
| Memory usage (%) | OOM kills, swap thrashing | 1-7 days |
| CPU utilization (%) | Saturation, request queueing | 1-3 days |
| Connection count | Pool exhaustion, connection refused | 1-24 hours |
| Error rate (%) | Service degradation | 1-6 hours |
| Request latency (P95) | SLA breach | 1-6 hours |
| Queue depth | Backpressure, message loss | 1-12 hours |
| Certificate expiry (days) | TLS handshake failure | 7-30 days |

Data quality checks before modeling:
- Gap detection: identify missing data points and fill with appropriate strategy (interpolation, forward-fill, or mark as missing)
- Outlier detection: identify and optionally exclude known incident periods from training data
- Stationarity test: ADF (Augmented Dickey-Fuller) test to determine if differencing is needed

### Step 2: Forecasting Model Selection and Fitting

Select the appropriate forecasting model based on the metric characteristics and required forecast horizon.

```
Tool: mcp__mcp-graph__forecast (metric: "<metric_name>", model: "auto")
```

Model selection guide:

| Model | Best For | Characteristics |
|-------|----------|-----------------|
| Holt-Winters | Strong seasonality (hourly/daily/weekly) | Fast, interpretable, handles additive and multiplicative seasonality |
| ARIMA/SARIMA | Stationary or differenced series | Classical, well-understood, good for short horizons |
| Prophet | Multiple seasonalities + holidays + changepoints | Robust to missing data, handles outliers, good for business metrics |
| LSTM | Complex nonlinear patterns | Captures long-range dependencies, requires more data |
| Linear regression | Simple monotonic growth | Fastest, best for disk/storage capacity planning |

Auto-selection logic:
1. If metric has strong seasonality (Fourier analysis) and the period is known, use Holt-Winters or Prophet
2. If metric is monotonically increasing (storage, counters), use linear regression
3. If metric has complex patterns and 30+ days of data, use Prophet
4. If metric is short-horizon and stationary, use ARIMA

Fit the model and compute prediction intervals (80% and 95% confidence).

### Step 3: Forecast Generation

Generate forecasts at the appropriate horizon for each metric.

```
Tool: mcp__mcp-graph__forecast (metric: "<metric_name>", horizon: "<hours or days>")
```

Forecast output per metric:
- Point forecast (most likely future value at each time step)
- 80% prediction interval (likely range)
- 95% prediction interval (conservative range)
- Time to threshold breach (when will the metric cross the critical threshold?)

Forecast refresh schedule:
- Short-horizon metrics (latency, error rate): refresh every 15 minutes
- Medium-horizon metrics (CPU, memory): refresh every hour
- Long-horizon metrics (disk, certificates): refresh daily

### Step 4: Predictive Alert Rule Definition

Define alert rules based on forecast thresholds rather than current values.

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Predictive alert structure:

| Field | Description | Example |
|-------|-------------|---------|
| Metric | What is being forecast | `disk_usage_percent` |
| Threshold | Critical value | 90% |
| Horizon | How far ahead to look | 7 days |
| Confidence | Which prediction interval to use | 95% (conservative) |
| Severity | Alert severity when triggered | Warning (7d), Critical (24h) |
| Cooldown | Minimum time between re-alerts | 4 hours |

Tiered alerting based on forecast horizon:

| Time to Breach | Severity | Action |
|----------------|----------|--------|
| > 7 days | Info | Log for capacity planning review |
| 3-7 days | Warning | Notify team, create planning task |
| 1-3 days | High | Notify on-call, create urgent task |
| < 24 hours | Critical | Page on-call, create incident task |
| Already breached | Emergency | Trigger auto-remediation if available |

### Step 5: Forecast Evaluation and Alert Triggering

Evaluate current forecasts against alert rules and trigger notifications for predicted breaches.

```
Tool: mcp__mcp-graph__metrics (scope: "forecast_evaluation")
```

For each metric with an active predictive alert rule:
1. Get the latest forecast
2. Find the earliest time the 95% upper bound crosses the threshold
3. Compute the time-to-breach
4. If time-to-breach falls within the alert horizon, trigger the alert
5. Include in the alert: current value, forecast trajectory, predicted breach time, confidence level

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Preventive Action — <metric> predicted breach in <N> days", priority: "<severity>")
```

### Step 6: Prediction Accuracy Tracking

Track how accurate forecasts are over time to calibrate models and build trust.

```
Tool: mcp__mcp-graph__metrics (scope: "forecast_accuracy")
```

Accuracy metrics:
- **MAPE (Mean Absolute Percentage Error)** -- average percentage error of point forecasts
- **Coverage** -- percentage of actual values that fall within the 95% prediction interval (target: 95%)
- **Bias** -- systematic over- or under-prediction (should be near zero)
- **False positive rate** -- predicted breaches that did not occur (target: < 10%)
- **False negative rate** -- actual breaches that were not predicted (target: < 5%)

If accuracy degrades:
- Check for concept drift (has the metric's behavior pattern changed?)
- Check for data quality issues (gaps, outliers contaminating training data)
- Re-fit the model with more recent data or switch to a different model

```
Tool: mcp__mcp-graph__analyze (mode: "validate_ready")
```

### Step 7: Record Predictions and Model Performance

Save forecasting results, alert history, and model performance for continuous improvement.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Predictive Alerting Report — <date>"
  content: "<metrics monitored, forecasts generated, alerts triggered, prediction accuracy (MAPE, coverage, bias), false positive/negative rates, model adjustments made>"
  tags: ["predictive-alerting", "forecasting", "aiops", "proactive"]
```

## Output Format

```
Phase: PREDICTIVE ALERTING
Metrics Monitored: <N>
Forecast Horizon: <shortest> to <longest>

Forecasts:
  Generated: <N>
  Breaches predicted: <N>
  Time to nearest breach: <N> hours/days (<metric>)

Alerts Triggered:
  Critical (< 24h): <N>
  High (1-3 days): <N>
  Warning (3-7 days): <N>
  Info (> 7 days): <N>

Preventive Tasks Created: <N>

Model Performance:
  MAPE: <N>%
  Coverage (95% CI): <N>%
  False positive rate: <N>%
  False negative rate: <N>%

Saved to memory: "Predictive Alerting Report — <date>"
```

## Anti-Patterns

- Do NOT use only static thresholds when metrics have clear trends or seasonality -- static thresholds cannot predict, only react
- Do NOT train forecasting models on data that includes known incident periods without marking them as anomalies
- Do NOT use a single model for all metric types -- different patterns require different models
- Do NOT alert on point forecasts alone -- always use prediction intervals to account for uncertainty
- Do NOT skip accuracy tracking -- unmonitored models degrade silently and generate false alerts
- Do NOT set forecast horizons longer than the model can reliably predict -- longer is not always better
- Do NOT ignore false positive feedback -- every false positive should feed back into model calibration
