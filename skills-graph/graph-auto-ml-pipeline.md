---
name: graph-auto-ml-pipeline
description: Automated ML pipeline for graph internal data supporting classification, regression, and clustering with automatic model selection and validation
triggers:
  - graph-auto-ml-pipeline
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-auto-ml-pipeline

Automated Machine Learning pipeline skill that applies AutoML methodology to any graph internal data. Supports classification (task risk, blocker prediction), regression (duration estimation, effort scoring), and clustering (task grouping, pattern discovery). Handles feature engineering, model selection, hyperparameter tuning, and validation automatically.

## When to Use

- When a new prediction task arises that no existing ML skill covers -- AutoML adapts to any tabular data from the graph
- During PLAN phase -- automatic effort estimation and risk classification for new tasks
- When existing heuristic rules underperform -- replace rule-based logic with learned models
- For exploratory analysis -- discover patterns in graph data without manual feature engineering
- After accumulating sufficient historical data (>50 completed tasks) -- unlock data-driven insights
- When comparing model approaches -- AutoML benchmarks multiple algorithms systematically

## Mandatory Flow

```
define task --> extract dataset --> auto feature engineering --> model search --> hyperparameter optimization --> cross-validation --> select best model --> generate predictions --> evaluate and report --> write_memory
```

## Workflow

### Step 1: Define the ML Task

Specify the prediction objective from predefined templates or custom definition:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

Predefined task templates:
| Template | Type | Target | Use Case |
|----------|------|--------|----------|
| `duration_prediction` | Regression | cycle_time_hours | Estimate how long a task will take |
| `risk_classification` | Classification | risk_level (low/med/high) | Predict task risk before starting |
| `blocker_prediction` | Classification | will_block (0/1) | Predict if a task will get blocked |
| `effort_estimation` | Regression | story_points | Estimate relative effort |
| `task_clustering` | Clustering | cluster_id | Group similar tasks automatically |
| `priority_ranking` | Regression | actual_priority_score | Learn optimal priority from outcomes |

Custom tasks: specify target column, task type, and evaluation metric.

### Step 2: Extract Dataset from Graph

Pull structured data from the execution graph:

```
Tool: mcp__mcp-graph__search (query: "*", type: "task")
Tool: mcp__mcp-graph__knowledge_stats
```

Dataset construction:
- Query all nodes matching the task scope (e.g., completed tasks for supervised learning)
- Extract features: structural (degree, depth, subtask count), textual (TF-IDF of description), temporal (creation day, sprint position), metadata (priority, type, phase)
- Extract target variable based on task template
- Handle missing values: median imputation for numeric, mode for categorical
- Remove features with >50% missing values

Data quality checks:
- Minimum samples: 50 for regression/classification, 30 for clustering
- Class balance: flag if minority class < 15% (classification tasks)
- Feature variance: remove zero-variance features

### Step 3: Automatic Feature Engineering

Generate candidate features beyond raw extractions:

| Generated Feature | Formula | Rationale |
|-------------------|---------|-----------|
| `dependency_complexity` | in_degree * out_degree | Interaction effects |
| `description_density` | ac_count / description_length | Requirements clarity |
| `sprint_load` | concurrent_tasks / sprint_capacity | Workload context |
| `blocker_risk_score` | blocked_neighbors / total_neighbors | Neighborhood risk |
| `recency` | 1 / (days_since_creation + 1) | Time decay |
| `epic_completion_pct` | siblings_done / siblings_total | Epic progress context |

Feature selection:
- Compute mutual information between each feature and target
- Remove features with MI < 0.01 (no predictive signal)
- Remove highly correlated features (Pearson > 0.95) keeping the one with higher MI
- Final feature set: 10-30 features

### Step 4: Model Search

Evaluate candidate models appropriate for the task type:

**Regression candidates:**
| Model | Hyperparameter Space |
|-------|---------------------|
| Ridge Regression | alpha: [0.01, 100] |
| Random Forest | n_estimators: [50, 500], max_depth: [3, 20] |
| LightGBM | num_leaves: [15, 63], learning_rate: [0.01, 0.3] |
| SVR | C: [0.1, 100], kernel: [rbf, linear] |

**Classification candidates:**
| Model | Hyperparameter Space |
|-------|---------------------|
| Logistic Regression | C: [0.01, 100], penalty: [l1, l2] |
| Random Forest | n_estimators: [50, 500], max_depth: [3, 20] |
| LightGBM | num_leaves: [15, 63], learning_rate: [0.01, 0.3] |
| SVM | C: [0.1, 100], kernel: [rbf, linear] |

**Clustering candidates:**
| Model | Hyperparameter Space |
|-------|---------------------|
| KMeans | k: [2, 10] |
| HDBSCAN | min_cluster_size: [3, 15], min_samples: [1, 10] |
| Gaussian Mixture | n_components: [2, 10], covariance: [full, diag] |

### Step 5: Hyperparameter Optimization

Use Bayesian optimization (Tree-structured Parzen Estimator) for efficient search:

- **Budget**: 50 trials per model
- **Search strategy**: TPE with 10 random initialization trials
- **Pruning**: Median pruning after 20% of cross-validation folds
- **Objective**: Primary evaluation metric (see Step 6)

Track all trials: hyperparameters, score, training time. Select Pareto-optimal models (best score vs training time tradeoff).

### Step 6: Cross-Validation

Evaluate each tuned model with rigorous validation:

- **Regression**: 5-fold time-series split, metrics: MAE, RMSE, R2, MAPE
- **Classification**: Stratified 5-fold, metrics: F1 (macro), Precision, Recall, AUC-ROC
- **Clustering**: Silhouette score, Calinski-Harabasz, Davies-Bouldin (no CV needed)

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Statistical significance: compare top-2 models using paired t-test on fold scores. Select the simpler model if difference is not significant (p > 0.05).

### Step 7: Select and Register Best Model

Register the winning model with metadata:

```
Tool: mcp__mcp-graph__write_memory (title: "AutoML Model — <task_template> v<N>", content: <model type, hyperparameters, validation metrics, feature importance>)
```

Model card:
- Task type and target variable
- Best model algorithm and hyperparameters
- Validation metrics (mean and std across folds)
- Top-10 feature importances
- Training data size and date range
- Expected staleness: retrain after 30 new completed tasks

### Step 8: Generate Predictions and Report

Run inference on the target population:

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For each prediction, provide:
- Point estimate and confidence interval (regression) or class probabilities (classification)
- Feature contribution: which features drove this prediction (SHAP values for top-3 features)
- Comparison with heuristic baseline

## Output Format

```
Phase: AUTO ML PIPELINE
Task: <task_template> (<regression|classification|clustering>)
Dataset: <N> samples, <N> features (after engineering)
Models Evaluated: <N> candidates, <N> trials total
Best Model: <algorithm> (score=<N>, train_time=<N>s)
  Hyperparameters: <key=value, ...>
  Validation: <metric>=<N> +/- <N> (5-fold)
  Top Features: <f1> (<importance>), <f2> (<importance>), <f3> (<importance>)
Baseline Comparison: <N>% improvement over <heuristic|previous_model>
Predictions Generated: <N> (active tasks)
  High Confidence: <N> predictions (confidence > 80%)
  Low Confidence: <N> predictions (confidence < 50%)

Saved to memory: "AutoML Model — <task_template> v<N>"
```

## Anti-Patterns

- Do NOT train on fewer than 50 samples for supervised learning -- results will be unreliable
- Do NOT skip cross-validation -- a single train/test split is insufficient for model selection
- Do NOT ignore class imbalance -- use SMOTE or class weights for imbalanced classification
- Do NOT use random split for time-dependent data -- always use time-series aware splitting
- Do NOT select the most complex model by default -- prefer simpler models when scores are comparable
- Do NOT deploy without a baseline comparison -- if AutoML does not beat the heuristic, keep the heuristic
- Do NOT forget to retrain -- models go stale as the graph evolves; track staleness and retrigger
