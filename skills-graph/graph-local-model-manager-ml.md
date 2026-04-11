---
name: graph-local-model-manager-ml
description: Local ML model lifecycle management including incremental training, quantization, versioning, A/B deployment, and performance monitoring
triggers:
  - graph-local-model-manager-ml
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-local-model-manager-ml

Local ML model lifecycle manager that handles the full model lifecycle for all ML skills in the graph ecosystem. Covers incremental training, model quantization for resource-constrained environments, semantic versioning, A/B deployment between model versions, rollback capability, and continuous performance monitoring. All operations are local-first with no external API dependencies.

## When to Use

- After any ML skill trains a new model -- register it in the model registry for versioning and tracking
- When model performance degrades -- trigger retraining with incremental learning on new data
- When resource constraints tighten -- quantize models to reduce memory and inference latency
- Before deploying a new model version -- A/B test against the incumbent to validate improvement
- During VALIDATE phase -- verify all active models meet minimum performance thresholds
- On monthly cadence -- audit all registered models for staleness and drift

## Mandatory Flow

```
inventory models --> check model health --> incremental training --> quantize if needed --> version and register --> A/B test deployment --> promote or rollback --> monitor performance --> write_memory
```

## Workflow

### Step 1: Inventory All Active Models

Scan the model registry and knowledge store for all ML models:

```
Tool: mcp__mcp-graph__knowledge_stats
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Model registry structure:
| Field | Description | Example |
|-------|-------------|---------|
| `model_id` | Unique identifier | `predictive-analytics-v3` |
| `skill` | Parent ML skill | `graph-ml-predictive-analytics` |
| `algorithm` | Model type | `LightGBM` |
| `version` | Semantic version | `3.1.0` |
| `created_at` | Training date | `2026-04-08` |
| `training_samples` | Number of training data points | `142` |
| `validation_metric` | Primary metric and value | `MAE=2.3h` |
| `status` | Current deployment status | `active|shadow|retired` |
| `staleness_days` | Days since last retrain | `12` |
| `inference_count` | Number of predictions made | `89` |
| `avg_inference_ms` | Average inference latency | `15ms` |

List all models with their health status: healthy, stale (>30 days), degraded (metric below threshold), or erroring.

### Step 2: Check Model Health

For each active model, run health diagnostics:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Health checks:
| Check | Threshold | Action on Failure |
|-------|-----------|-------------------|
| `staleness` | < 30 days since last train | Schedule retraining |
| `data_drift` | PSI < 0.2 (Population Stability Index) | Flag for investigation |
| `prediction_drift` | KL divergence < 0.1 | Trigger retraining |
| `accuracy_degradation` | < 10% drop from training metric | Trigger retraining |
| `inference_latency` | < 100ms p95 | Consider quantization |
| `error_rate` | < 1% of inferences | Investigate errors |
| `coverage` | > 90% of inputs produce valid output | Fix edge cases |

Data drift detection:
- Compare feature distributions of recent inputs vs training data
- Use Population Stability Index (PSI) per feature
- PSI > 0.2 = significant drift, retrain with new data distribution

### Step 3: Incremental Training

For models flagged for retraining, use incremental learning:

```
Tool: mcp__mcp-graph__metrics (type: "cycle_time")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Incremental training strategy:
- **Warm start**: initialize from current model weights, train on new data only
- **Window**: use a sliding window of recent data (last 60 days) to capture distribution shifts
- **Regularization**: increase weight decay slightly to prevent catastrophic forgetting
- **Validation**: compare incrementally trained model against full retrain on holdout set

Decision matrix:
| Condition | Action |
|-----------|--------|
| PSI < 0.1 (no drift) | Warm start on new data |
| 0.1 < PSI < 0.3 (moderate drift) | Warm start with increased learning rate |
| PSI > 0.3 (severe drift) | Full retrain on windowed data |
| Accuracy improved after incremental | Accept new model |
| Accuracy degraded after incremental | Full retrain, investigate |

### Step 4: Quantize Models

For resource-constrained deployment, apply model compression:

Quantization techniques by model type:
| Model | Technique | Size Reduction | Accuracy Loss |
|-------|-----------|----------------|---------------|
| LightGBM | Leaf pruning + 16-bit weights | 40-60% | < 1% |
| Neural Network | INT8 quantization | 60-75% | 1-3% |
| Random Forest | Tree pruning (max_depth reduction) | 30-50% | < 2% |
| Prophet | Reduce MCMC samples | 50% | < 1% |

Quantization validation:
- Run quantized model on full validation set
- Accept if accuracy loss < 3% compared to full model
- Measure inference latency improvement
- Measure memory reduction

```
Tool: mcp__mcp-graph__write_memory (title: "Model Quantization — <model_id>", content: <original vs quantized metrics>)
```

### Step 5: Version and Register

Apply semantic versioning to the new model:

- **Major** (X.0.0): algorithm change, feature set change, breaking output format
- **Minor** (x.Y.0): retrained with new data, hyperparameter changes
- **Patch** (x.y.Z): quantization, bug fix, metadata update

Registration:
```
Tool: mcp__mcp-graph__write_memory (title: "Model Registry — <model_id> v<version>", content: <full model card>)
```

Model card contents:
- Model ID, version, algorithm, skill
- Training data description (size, date range, features)
- Validation metrics (with confidence intervals)
- Hyperparameters
- Quantization details (if applicable)
- Known limitations and failure modes
- Predecessor model version and comparison

### Step 6: A/B Test Deployment

Deploy new model in shadow mode alongside the incumbent:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

A/B testing protocol:
1. **Shadow mode**: new model runs on all inputs but its predictions are not surfaced
2. **Comparison**: log both models' predictions for the same inputs
3. **Duration**: minimum 20 predictions or 7 days, whichever comes first
4. **Evaluation**: compare metrics on shared inputs using paired statistical test
5. **Decision**: promote if new model is statistically better (p < 0.05) or comparable with lower latency

Status transitions:
```
shadow -> [passes A/B] -> active (old model -> retired)
shadow -> [fails A/B] -> retired (old model stays active)
```

### Step 7: Promote or Rollback

Execute the deployment decision:

For promotion:
- Set new model status to `active`
- Set old model status to `retired` (keep for 30 days for emergency rollback)
- Update all dependent skills to use new model version

For rollback:
- Set new model status to `retired`
- Log failure reason and metrics
- Schedule investigation and full retrain

```
Tool: mcp__mcp-graph__write_memory (title: "Model Deployment — <model_id> v<version>", content: <A/B results, decision, rollback plan>)
```

### Step 8: Continuous Monitoring

Set up ongoing monitoring for all active models:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__write_memory (title: "Model Health Report — <date>", content: <all models status, alerts, actions>)
```

Monitoring dashboard data:
- Per-model: accuracy trend, latency trend, inference count, error rate
- Aggregate: total models (active/shadow/retired), average staleness, drift alerts
- Alerts: models approaching staleness threshold, accuracy degradation detected

Automated triggers:
- Staleness > 25 days: schedule incremental retraining
- Accuracy drop > 5%: trigger immediate retraining
- Latency > 2x baseline: trigger quantization review
- Error rate > 0.5%: trigger investigation

## Output Format

```
Phase: MODEL LIFECYCLE MANAGEMENT
Models Registered: <N> total (<N> active, <N> shadow, <N> retired)

Model Health Summary:
  Healthy: <N>
  Stale (>30d): <N> — scheduled for retraining
  Degraded: <N> — accuracy below threshold
  Drifted: <N> — data distribution shifted

Actions Taken:
  Incremental Retrain: <N> models
  Full Retrain: <N> models
  Quantized: <N> models (avg size reduction: <N>%)
  Promoted: <N> models (A/B test passed)
  Rolled Back: <N> models (A/B test failed)

Model Details:
  <model_id> v<version>: <status>, <metric>=<value>, staleness=<N>d
  <model_id> v<version>: <status>, <metric>=<value>, staleness=<N>d

Next Scheduled Actions:
  <model_id>: retrain by <date>
  <model_id>: A/B test completes <date>

Saved to memory: "Model Health Report — <date>"
```

## Anti-Patterns

- Do NOT deploy models without A/B testing -- silent regressions compound over time
- Do NOT skip versioning -- unversioned models cannot be rolled back or audited
- Do NOT retrain without validation -- incremental training can degrade if data quality drops
- Do NOT keep retired models indefinitely -- clean up after 30-day rollback window
- Do NOT quantize without measuring accuracy loss -- some models are sensitive to precision reduction
- Do NOT ignore data drift -- a model trained on different data distribution will silently produce bad predictions
- Do NOT manage models manually -- automate the lifecycle to prevent human error in deployment
