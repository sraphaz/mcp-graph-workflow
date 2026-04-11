---
name: graph-ai-evaluation-framework
description: AI output quality evaluation framework — measures precision, coherence, hallucination rate, and other SOTA metrics for continuous quality assurance
triggers:
  - graph-ai-evaluation-framework
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-ai-evaluation-framework

Provides a comprehensive evaluation framework for measuring AI output quality across multiple dimensions including factual precision, logical coherence, hallucination rate, instruction following, and code correctness. Produces quantitative quality scores that feed back into the workflow to drive continuous improvement.

## When to Use

- After completing a sprint to evaluate aggregate output quality
- When introducing a new model or prompt strategy — to establish quality baselines
- When quality complaints arise from users or downstream consumers
- Proactively after every 10 completed tasks to detect quality drift
- When comparing two approaches (A/B test evaluation)
- Autonomously when `metrics` show DoD grade degradation trend

## Mandatory Flow

```
analyze(quality_baseline) → define_rubric → sample_outputs → evaluate_dimensions → calculate_scores → generate_report → write_memory
```

## Workflow

### Step 1: Establish Evaluation Baseline

Gather current quality metrics from the graph:
```
Tool: mcp__mcp-graph__metrics
```

Load historical quality data for trend analysis:
```
Tool: mcp__mcp-graph__rag_context (query: "quality evaluation scores baseline trends")
```

Baseline metrics to capture:

| Metric | Current | Previous Sprint | Trend |
|--------|---------|----------------|-------|
| Avg DoD Grade | | | |
| First-pass success rate | | | |
| Rework rate | | | |
| Hallucination incidents | | | |
| AC satisfaction rate | | | |

### Step 2: Define Evaluation Rubric

Configure the multi-dimensional evaluation rubric:

| Dimension | Weight | Scale | Description |
|-----------|--------|-------|-------------|
| **Factual Precision** | 25% | 0-10 | Claims are verifiable against source material |
| **Logical Coherence** | 20% | 0-10 | Reasoning chain is sound with no gaps or contradictions |
| **Instruction Following** | 20% | 0-10 | Output addresses exactly what was asked |
| **Code Correctness** | 15% | 0-10 | Generated code compiles, passes tests, handles edge cases |
| **Completeness** | 10% | 0-10 | All requirements and AC are fully addressed |
| **Conciseness** | 5% | 0-10 | No unnecessary verbosity or repetition |
| **Safety** | 5% | 0-10 | No harmful patterns, security issues, or data leaks |

Rubric is adjustable per project phase:
- IMPLEMENT phase: Code Correctness weight increases to 25%
- DESIGN phase: Logical Coherence weight increases to 30%
- REVIEW phase: Factual Precision weight increases to 30%

### Step 3: Sample Outputs for Evaluation

Select a representative sample of recent outputs:
```
Tool: mcp__mcp-graph__search (query: "status:done")
```

Sampling strategy:
- **Stratified by complexity**: Include XS, S, M, L, XL tasks proportionally
- **Stratified by type**: Include implementation, design, test, and review tasks
- **Minimum sample size**: 10 outputs per evaluation cycle
- **Include edge cases**: Always include the lowest-graded and highest-graded outputs

### Step 4: Evaluate Each Dimension

For each sampled output, score all rubric dimensions:

**Factual Precision Check:**
```
Tool: mcp__mcp-graph__rag_context (query: "<claim_from_output>")
```
Verify each factual claim against the knowledge store and codebase. Score: (verified claims / total claims) * 10.

**Logical Coherence Check:**
Trace the reasoning chain from premises to conclusion. Flag: non-sequiturs, circular reasoning, unsupported leaps, contradictions. Score: 10 - (2 * number_of_issues).

**Instruction Following Check:**
Compare output against task description and AC. Score: (satisfied_instructions / total_instructions) * 10.

**Code Correctness Check:**
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```
Verify: compilation, test pass rate, edge case coverage, error handling. Score: weighted average of sub-checks.

**Completeness Check:**
Map output sections to AC items. Score: (covered_AC / total_AC) * 10.

**Conciseness Check:**
Measure signal-to-noise ratio. Penalize: redundant paragraphs, unnecessary caveats, repeated information. Score: 10 - (redundant_sections * 2).

**Safety Check:**
Scan for: hardcoded secrets, SQL injection vectors, unvalidated inputs, exposed internals. Score: 10 - (safety_issues * 5).

### Step 5: Calculate Composite Scores

Compute weighted scores per output and aggregate:

```
composite_score = sum(dimension_score * dimension_weight) for all dimensions
```

Grade mapping:

| Score Range | Grade | Action |
|-------------|-------|--------|
| 9.0-10.0 | A+ | Exemplary — add to few-shot examples |
| 8.0-8.9 | A | Meets all standards |
| 7.0-7.9 | B | Acceptable — minor improvements possible |
| 6.0-6.9 | C | Below standard — requires process improvement |
| <6.0 | D | Unacceptable — requires investigation and correction |

### Step 6: Hallucination Rate Analysis

Dedicated deep-dive into hallucination patterns:

| Hallucination Type | Count | Severity | Example |
|-------------------|-------|----------|---------|
| Fabricated API | | High | Referenced non-existent function |
| Wrong import path | | Medium | Used incorrect module path |
| Invented constraint | | Medium | Claimed non-existent limitation |
| Stale reference | | Low | Used outdated API signature |
| Phantom feature | | High | Described unimplemented capability |

Calculate hallucination rate: (outputs_with_hallucinations / total_outputs) * 100

Target: <5% hallucination rate. If >10%, trigger immediate investigation.

### Step 7: Generate Evaluation Report

Compile all scores into a comprehensive report:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 8: Persist Evaluation Results

Save evaluation data for trend tracking:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "AI Evaluation [date]: Composite=<score>/10, Grade=<grade>. Precision=<N>, Coherence=<N>, Instruction=<N>, Code=<N>, Complete=<N>, Concise=<N>, Safety=<N>. Hallucination rate=<N>%. Sample size=<N>."
  tags: ["ai-evaluation", "quality-metrics", "hallucination-rate"]
```

For dimension-specific findings:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "errors"
  content: "Evaluation finding: <dimension> scored below threshold (<score>/<threshold>). Root cause: <analysis>. Corrective action: <recommendation>."
  tags: ["ai-evaluation", "<dimension>", "corrective-action"]
```

### Step 9: Self-Healing Quality Loop

Use evaluation results to drive automated improvements:

1. **Low Factual Precision** → Trigger `graph-advanced-rag-optimizer` to improve retrieval
2. **Low Logical Coherence** → Trigger `graph-reasoning-engine` to upgrade reasoning strategy
3. **High Hallucination Rate** → Trigger `graph-self-reflection` for deep hallucination audit
4. **Low Code Correctness** → Review TDD compliance and test coverage
5. **Declining Trend** → Trigger `graph-auto-prompt-optimizer` to tune prompts

Track the improvement cycle:
```
Tool: mcp__mcp-graph__metrics
```

## Output Format

```
AI Evaluation Report
====================
Period: <date_range>
Outputs Evaluated: <N>

Dimension Scores (weighted):
  Factual Precision:    <score>/10 (weight: 25%)
  Logical Coherence:    <score>/10 (weight: 20%)
  Instruction Following: <score>/10 (weight: 20%)
  Code Correctness:     <score>/10 (weight: 15%)
  Completeness:         <score>/10 (weight: 10%)
  Conciseness:          <score>/10 (weight: 5%)
  Safety:               <score>/10 (weight: 5%)

Composite Score: <score>/10 (Grade: <grade>)
Trend: <improving/stable/degrading> vs previous evaluation

Hallucination Analysis:
  Rate: <N>%
  Types: <breakdown>
  Severity: <high_count> high, <med_count> medium, <low_count> low

Grade Distribution:
  A+: <N> | A: <N> | B: <N> | C: <N> | D: <N>

Recommended Actions:
  - <action_1> (priority: <high/medium/low>)
  - <action_2> (priority: <high/medium/low>)

Next Evaluation: after <N> tasks
```

## Anti-Patterns

- Do NOT evaluate with fewer than 10 sampled outputs — small samples produce unreliable metrics
- Do NOT weight all dimensions equally when the project phase demands emphasis on specific ones
- Do NOT ignore trend data — a single good score after three declining sprints is not recovery
- Do NOT skip the hallucination deep-dive — composite scores can mask high hallucination rates
- Do NOT treat evaluation as a one-time activity — it must run every sprint to catch drift
- Do NOT grade your own outputs without cross-referencing the knowledge store and codebase
- Do NOT persist evaluation results without corrective actions — measurement without action is waste
