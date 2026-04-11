---
name: graph-hyperparameter-tuner
description: Bayesian hyperparameter tuning for all graph skills including BM25, embeddings, workers, and ML models using Optuna-like optimization
triggers:
  - graph-hyperparameter-tuner
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-hyperparameter-tuner

Bayesian hyperparameter tuning skill that optimizes configuration parameters across all graph skills -- BM25 weights, embedding dimensions, worker concurrency, RAG retrieval thresholds, context compression ratios, and ML model hyperparameters. Uses Tree-structured Parzen Estimator (TPE) for sample-efficient optimization with pruning.

## When to Use

- After deploying a new ML skill -- tune its hyperparameters for the specific project's data distribution
- When RAG retrieval quality degrades -- optimize BM25 k1/b parameters and similarity thresholds
- When context compression is too aggressive or too loose -- tune compression ratios and token budgets
- During VALIDATE phase -- systematically optimize pipeline performance instead of manual guessing
- After significant graph growth (>2x nodes) -- parameters tuned for small graphs may be suboptimal at scale
- Periodically (monthly) -- drift in data characteristics requires parameter recalibration

## Mandatory Flow

```
define search space --> define objective function --> initialize sampler --> run trials --> prune underperformers --> analyze results --> select best config --> validate improvement --> deploy config --> write_memory
```

## Workflow

### Step 1: Define Search Space

Catalog all tunable parameters organized by subsystem:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__rag_context (query: "current configuration", scope: "settings")
```

**RAG Pipeline Parameters:**
| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `bm25_k1` | Float | [0.5, 3.0] | 1.2 |
| `bm25_b` | Float | [0.0, 1.0] | 0.75 |
| `tfidf_min_df` | Int | [1, 5] | 2 |
| `tfidf_max_df_ratio` | Float | [0.5, 0.95] | 0.85 |
| `similarity_threshold` | Float | [0.1, 0.9] | 0.3 |
| `top_k_results` | Int | [3, 20] | 10 |
| `chunk_size_tokens` | Int | [128, 1024] | 512 |
| `chunk_overlap_ratio` | Float | [0.0, 0.3] | 0.1 |

**Context Compression Parameters:**
| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `max_context_tokens` | Int | [500, 4000] | 2000 |
| `compression_tier` | Categorical | [minimal, balanced, aggressive] | balanced |
| `dependency_depth` | Int | [1, 5] | 2 |
| `include_knowledge` | Boolean | [true, false] | true |

**ML Model Parameters (per skill):**
| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `embedding_dim` | Int | [16, 128] | 64 |
| `gnn_heads` | Int | [1, 8] | 4 |
| `isolation_forest_contamination` | Float | [0.01, 0.15] | 0.05 |
| `prophet_changepoint_prior` | Float | [0.001, 0.5] | 0.05 |
| `lightgbm_num_leaves` | Int | [15, 127] | 31 |

### Step 2: Define Objective Function

Each subsystem has a measurable objective:

| Subsystem | Objective | Metric | Direction |
|-----------|-----------|--------|-----------|
| RAG Pipeline | Retrieval quality | Mean Reciprocal Rank (MRR) | Maximize |
| Context Compression | Information density | Relevant tokens / total tokens | Maximize |
| BM25 Search | Search accuracy | NDCG@10 | Maximize |
| ML Predictions | Prediction accuracy | MAE (regression), F1 (classification) | Minimize/Maximize |
| Anomaly Detection | Detection quality | F1 on labeled anomalies | Maximize |

Composite objective for multi-subsystem tuning:
```
objective = w1 * normalized_metric_1 + w2 * normalized_metric_2 + ... + penalty(latency)
```

Where `penalty(latency) = -0.1 * max(0, latency_ms - threshold_ms)` to prevent slow configurations.

### Step 3: Initialize Bayesian Sampler

Configure the TPE (Tree-structured Parzen Estimator) sampler:

- **n_startup_trials**: 10 (random search before Bayesian kicks in)
- **n_ei_candidates**: 24 (exploration-exploitation tradeoff)
- **multivariate**: true (model parameter interactions)
- **seed**: 42 (reproducibility)

Initialize the study:
- Storage: in-memory SQLite for trial history
- Direction: maximize or minimize based on objective
- Pruner: MedianPruner with `n_startup_trials=5, n_warmup_steps=3`

### Step 4: Run Optimization Trials

Execute the optimization loop:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For each trial (budget: 100 trials):
1. Sampler suggests parameter configuration
2. Apply configuration to the target subsystem
3. Run evaluation (retrieval benchmark, prediction benchmark, etc.)
4. Record metric value
5. Pruner decides whether to continue or prune early

Track per trial:
- Parameters sampled
- Objective value achieved
- Evaluation time
- Whether pruned (and at which step)

Log progress every 10 trials: best score, improvement rate, pruning rate.

### Step 5: Prune Underperformers

Pruning strategy eliminates bad configurations early:

- **MedianPruner**: at each intermediate step, prune if current value is worse than median of completed trials at same step
- **Aggressive after 50 trials**: tighten to percentile 25 (prune bottom 75%)
- **Never prune top performers**: if a trial is in top-10% at any step, let it complete

Pruning saves 40-60% of compute budget while maintaining solution quality.

### Step 6: Analyze Results

After all trials complete, analyze the optimization landscape:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Key analyses:
- **Best parameters**: top-1 configuration and its objective value
- **Parameter importance**: which parameters had the largest effect on objective
- **Parameter interactions**: pairs of parameters with strong interaction effects
- **Convergence**: did the optimization converge or is more budget needed?
- **Pareto front**: for multi-objective, show tradeoff between metrics

Visualization data:
- Parameter importance ranking (fANOVA)
- Optimization history (objective vs trial number)
- Parameter correlation with objective (slice plots)

### Step 7: Validate Improvement

Before deploying, validate the best configuration:

```
Tool: mcp__mcp-graph__rag_context (query: "validation test", scope: "graph")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

Validation protocol:
1. Compare best found config vs current default config
2. Run 10 evaluation repetitions with different random seeds
3. Compute mean and standard deviation of objective for both configs
4. Apply Welch's t-test: improvement must be significant (p < 0.05)
5. Check no secondary metric regresses by more than 5%

If improvement is not statistically significant, keep current defaults and log findings.

### Step 8: Deploy Configuration and Persist

Apply the validated configuration:

```
Tool: mcp__mcp-graph__write_memory (title: "Hyperparameter Tuning — <subsystem> <date>", content: <best params, improvement, trial summary>)
```

Deployment checklist:
- Record previous configuration for rollback
- Apply new parameters
- Run smoke test to verify no errors
- Set retuning reminder: retune after 50 new data points or 30 days

## Output Format

```
Phase: HYPERPARAMETER TUNING
Subsystem: <RAG Pipeline | Context | ML Model | ...>
Search Space: <N> parameters (<N> continuous, <N> categorical, <N> integer)
Trials: <N> completed, <N> pruned (<N>% pruning rate)
Best Configuration:
  <param_1>: <value> (default: <default>)
  <param_2>: <value> (default: <default>)
  <param_3>: <value> (default: <default>)
Objective: <metric_name> = <best_value> (default: <default_value>)
Improvement: <N>% over default (p-value: <N>)
Parameter Importance:
  1. <param>: <importance_score>
  2. <param>: <importance_score>
  3. <param>: <importance_score>
Convergence: <converged | needs_more_budget>
Status: <deployed | kept_default>

Saved to memory: "Hyperparameter Tuning — <subsystem> <date>"
```

## Anti-Patterns

- Do NOT manually guess hyperparameters -- systematic search finds configurations humans miss
- Do NOT use grid search -- it scales exponentially with dimensions; Bayesian optimization is far more efficient
- Do NOT optimize without a holdout set -- in-sample optimization leads to overfitting
- Do NOT tune all subsystems simultaneously -- optimize one at a time to isolate effects
- Do NOT ignore parameter interactions -- multivariate TPE captures interactions that independent tuning misses
- Do NOT deploy without statistical validation -- lucky random seeds can produce false improvements
- Do NOT retune too frequently -- parameter instability confuses downstream systems; tune monthly or on significant data changes
