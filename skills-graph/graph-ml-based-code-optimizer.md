---
name: graph-ml-based-code-optimizer
description: ML-driven code optimization suggestions based on project patterns, complexity analysis, and learned refactoring opportunities
triggers:
  - graph-ml-based-code-optimizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-ml-based-code-optimizer

ML-powered code optimization skill that analyzes project source code patterns to suggest data-driven improvements. Uses learned models from project history to identify complexity hotspots, predict bug-prone modules, recommend refactoring targets, and detect anti-patterns specific to the project's codebase. Leverages Code Intelligence symbol data as the primary input.

## When to Use

- During REVIEW phase -- identify optimization opportunities before merging
- After completing a feature epic -- analyze newly added code for quality patterns
- When performance metrics degrade -- trace degradation to code complexity increases
- During technical debt sprints -- prioritize refactoring targets by ML-predicted impact
- Before major refactoring -- predict which modules benefit most from restructuring
- Proactively after Code Intelligence reindex -- run analysis on newly indexed symbols

## Mandatory Flow

```
extract code metrics --> build feature matrix --> train complexity predictor --> train bug predictor --> analyze current codebase --> rank optimization targets --> generate recommendations --> validate suggestions --> write_memory
```

## Workflow

### Step 1: Extract Code Metrics via Code Intelligence

Gather symbol-level metrics from the code index:

```
Tool: mcp__mcp-graph__code_intelligence (action: "search", query: "*")
Tool: mcp__mcp-graph__code_intelligence (action: "stats")
```

Per-file metrics:
| Metric | Description | Source |
|--------|-------------|--------|
| `loc` | Lines of code | File analysis |
| `function_count` | Number of functions/methods | Symbol index |
| `class_count` | Number of classes | Symbol index |
| `import_count` | Number of import statements | Symbol index |
| `export_count` | Number of exports | Symbol index |
| `cyclomatic_complexity` | Control flow complexity estimate | AST analysis |
| `dependency_fan_in` | Number of modules importing this file | Relationship graph |
| `dependency_fan_out` | Number of modules this file imports | Relationship graph |
| `coupling_score` | fan_in * fan_out (afferent * efferent) | Computed |
| `churn_rate` | Number of modifications in recent history | Git log |

Per-function metrics:
| Metric | Description | Source |
|--------|-------------|--------|
| `parameter_count` | Number of function parameters | Symbol index |
| `return_type_complexity` | Nested generics depth | AST analysis |
| `call_depth` | Maximum call chain depth | Graph traversal |
| `callers_count` | Number of functions calling this one | Relationship graph |
| `callees_count` | Number of functions this one calls | Relationship graph |

### Step 2: Build Feature Matrix

Transform code metrics into ML-ready features:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Feature engineering:
| Feature | Formula | Rationale |
|---------|---------|-----------|
| `instability` | fan_out / (fan_in + fan_out) | Robert C. Martin's instability metric |
| `abstractness` | interfaces / (interfaces + classes) | Abstract vs concrete ratio |
| `distance_from_main` | abs(abstractness + instability - 1) | Distance from main sequence |
| `god_class_score` | loc * method_count * coupling_score | Monolithic class indicator |
| `feature_envy_score` | external_calls / total_calls | Method using other classes' data |
| `shotgun_surgery_score` | callers_count * churn_rate | Change here affects many places |
| `data_clump_score` | shared_parameter_groups | Repeated parameter patterns |

Normalize all features to [0, 1] using robust scaling (median, IQR).

### Step 3: Train Complexity Predictor

Train a model to predict which files/functions will grow most complex:

- **Algorithm**: Gradient Boosted Trees (LightGBM)
- **Target**: future complexity increase (measured by delta in cyclomatic complexity over time)
- **Features**: current metrics + historical trend features
- **Validation**: time-series split (train on older commits, test on recent)

This model identifies code that is on a trajectory toward high complexity before it gets there.

### Step 4: Train Bug Predictor

Train a model to predict bug-prone modules:

- **Algorithm**: Random Forest classifier
- **Target**: whether a module had bug-fix commits in the following sprint (binary)
- **Features**: code metrics + churn features + coupling scores
- **Class balancing**: SMOTE for minority class (bug-fix modules)
- **Validation**: stratified 5-fold, metric: F1, Precision, Recall

Top predictive features (from literature and practice):
1. Churn rate (strongest predictor)
2. Cyclomatic complexity
3. Coupling score (fan_in * fan_out)
4. File size (LOC)
5. Number of contributors (from git)

```
Tool: mcp__mcp-graph__write_memory (title: "Code Optimizer — Bug Predictor Model", content: <model metrics, feature importance>)
```

### Step 5: Analyze Current Codebase

Run inference on the entire codebase:

```
Tool: mcp__mcp-graph__code_intelligence (action: "search", query: "*")
Tool: mcp__mcp-graph__search (query: "code quality")
```

For each file/function, compute:
- **Complexity trajectory**: predicted future complexity (from Step 3)
- **Bug probability**: likelihood of needing a bug-fix (from Step 4)
- **Optimization score**: weighted combination of metrics indicating refactoring need
- **Impact score**: how many other modules benefit if this one is improved (from Code Intelligence graph traversal)

Combined optimization priority:
```
priority = 0.3 * bug_probability + 0.3 * complexity_trajectory + 0.2 * coupling_score + 0.2 * impact_score
```

### Step 6: Rank Optimization Targets

Rank all modules by optimization priority and generate actionable targets:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Top-N optimization targets with specific recommendations:

| Priority | Module | Issue | Recommendation |
|----------|--------|-------|----------------|
| 1 | High coupling + high complexity | God class / God function | Extract responsibilities into separate modules |
| 2 | High fan_out + frequent changes | Shotgun surgery | Introduce facade or mediator pattern |
| 3 | High bug probability | Historical instability | Add comprehensive test coverage first |
| 4 | Growing complexity trajectory | Trending toward unmaintainable | Refactor before next feature addition |
| 5 | Distance from main sequence | Architectural concern | Move toward stable-abstract or volatile-concrete |

### Step 7: Generate Specific Recommendations

For each top target, generate concrete refactoring suggestions:

```
Tool: mcp__mcp-graph__code_intelligence (action: "impact", symbolName: <target>)
```

Recommendation format per target:
- **What**: specific function/class to refactor
- **Why**: ML-predicted risk (bug probability, complexity growth)
- **How**: suggested refactoring pattern (extract method, split class, introduce interface)
- **Impact**: upstream/downstream modules affected (from Code Intelligence)
- **Effort**: estimated complexity of the refactoring (small/medium/large)
- **Test coverage**: existing tests that will need updating

Cross-reference with graph tasks:
```
Tool: mcp__mcp-graph__search (query: "<module_name>", type: "task")
```

If a related task already exists in the graph, link the recommendation to it. If not, suggest creating a new task node.

### Step 8: Validate and Persist

Validate suggestions against project conventions:

```
Tool: mcp__mcp-graph__write_memory (title: "Code Optimization Analysis — <date>", content: <targets, predictions, recommendations, model accuracy>)
```

Include:
- Model accuracy metrics (complexity predictor R2, bug predictor F1)
- Calibration data: past predictions vs actual outcomes
- Top-10 optimization targets with full recommendation details
- Estimated total effort for all recommendations

## Output Format

```
Phase: ML CODE OPTIMIZATION
Files Analyzed: <N> files, <N> functions, <N> classes
Model Accuracy: complexity_R2=<N>, bug_F1=<N>, bug_precision=<N>

Top Optimization Targets:
  1. <file>:<function> — priority=<N>/100
     Issue: <god_class|shotgun_surgery|high_coupling|...>
     Bug Probability: <N>%
     Complexity Trend: <stable|growing|critical>
     Recommendation: <specific action>
     Impact: <N> downstream modules affected
     Effort: <small|medium|large>

  2. <file>:<function> — priority=<N>/100
     ...

Codebase Health Summary:
  Avg Coupling: <N> (threshold: <N>)
  High Bug Risk Modules: <N>/<N> (<N>%)
  Growing Complexity: <N> modules on upward trajectory
  Distance from Main Sequence: avg=<N> (ideal: 0)

Recommendations: <N> total (<N> small, <N> medium, <N> large effort)
Estimated Total Effort: <N> hours

Saved to memory: "Code Optimization Analysis — <date>"
```

## Anti-Patterns

- Do NOT suggest refactoring without measuring current state -- always baseline before recommending changes
- Do NOT optimize stable, low-churn modules -- focus on modules with active development and high change frequency
- Do NOT ignore test coverage in recommendations -- refactoring without tests introduces regression risk
- Do NOT treat all complexity equally -- essential complexity (domain logic) is different from accidental complexity
- Do NOT recommend large refactors without impact analysis -- use Code Intelligence blast radius first
- Do NOT skip validation of past predictions -- track whether predicted bug-prone modules actually had bugs
- Do NOT generate recommendations that violate project conventions -- check CLAUDE.md rules before suggesting patterns
