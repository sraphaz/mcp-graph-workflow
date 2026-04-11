---
name: graph-auto-prompt-optimizer
description: Adaptive prompt and few-shot optimization — tunes prompts based on task outcomes, optimizes chain-of-thought, and manages few-shot example selection
triggers:
  - graph-auto-prompt-optimizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-auto-prompt-optimizer

Automatically tunes prompt templates and few-shot examples based on task outcomes, optimizing chain-of-thought structure, instruction clarity, and example selection. Builds a prompt performance registry in the knowledge store and continuously improves prompt effectiveness through A/B testing and feedback loops.

## When to Use

- After a batch of tasks shows inconsistent output quality (mix of Grade A and C/D)
- When introducing a new task type that lacks established prompt patterns
- When prompt token costs are disproportionately high relative to output quality
- Proactively after every sprint to identify underperforming prompt templates
- When agent outputs consistently miss specific acceptance criteria dimensions
- Autonomously when the prompt-to-quality ratio degrades below historical baseline

## Mandatory Flow

```
rag_context(prompt_history) → evaluate_prompts → identify_weak_patterns → generate_variants → ab_test → select_winner → write_memory
```

## Workflow

### Step 1: Gather Prompt Performance Data

Retrieve historical prompt patterns and their outcomes:
```
Tool: mcp__mcp-graph__rag_context (query: "prompt patterns effectiveness task outcomes")
```

Collect outcome metrics for recent tasks:
```
Tool: mcp__mcp-graph__metrics
```

Build a prompt performance registry:

| Prompt Pattern | Tasks Used | Avg Grade | Avg Tokens | Success Rate |
|----------------|-----------|-----------|------------|--------------|
| Standard CoT | N | B+ | 2400 | 78% |
| Structured AC-first | N | A- | 1800 | 91% |
| Few-shot (3 examples) | N | A | 3200 | 94% |
| Minimal instruction | N | C+ | 800 | 52% |

### Step 2: Identify Weak Patterns

Analyze which prompt components correlate with poor outcomes:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Common weakness categories:
- **Vague instructions**: Prompt lacks specific action verbs or measurable criteria
- **Missing context**: Prompt does not reference relevant dependencies or constraints
- **Over-specification**: Prompt is so detailed it constrains creative solutions
- **Poor examples**: Few-shot examples do not match the task domain
- **Token waste**: Prompt includes redundant or low-signal information

### Step 3: Generate Prompt Variants

For each underperforming pattern, generate 2-3 optimized variants:

**Variant strategies:**

| Strategy | Technique | When to Apply |
|----------|-----------|---------------|
| Instruction sharpening | Replace vague verbs with specific actions | When outputs miss the mark |
| Context injection | Add graph context, dependencies, constraints | When outputs ignore system state |
| Few-shot rotation | Replace examples with more relevant ones | When examples are stale or off-domain |
| CoT restructuring | Change reasoning step order or granularity | When reasoning chains are fragmented |
| Token compression | Remove redundant context, use references | When token cost is too high |
| Negative examples | Add "do NOT" clauses for common mistakes | When specific error patterns recur |

### Step 4: Select Few-Shot Examples

Curate the optimal few-shot example set from completed tasks:
```
Tool: mcp__mcp-graph__rag_context (query: "high quality task completions grade A examples")
```

Selection criteria for few-shot examples:
1. **Relevance**: Example task type matches target task type
2. **Recency**: Prefer recent examples (within last 2 sprints)
3. **Quality**: Only Grade A completions qualify as examples
4. **Diversity**: Examples should cover different aspects of the task type
5. **Brevity**: Shortest example that still demonstrates the pattern

Maintain an example pool of 10-15 candidates per task type, selecting 2-3 per prompt.

### Step 5: A/B Test Variants

Apply different prompt variants to comparable tasks and measure outcomes:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

A/B testing protocol:
1. Identify 4+ pending tasks of similar complexity and type
2. Assign variant A to half, variant B to the other half
3. After completion, compare: Grade, cycle time, token usage, rework rate
4. Statistical significance: need at least 4 tasks per variant for reliable comparison

Track test results:
```
Tool: mcp__mcp-graph__metrics
```

### Step 6: Select Winner and Promote

Compare variant performance across all dimensions:

| Dimension | Weight | Variant A | Variant B | Winner |
|-----------|--------|-----------|-----------|--------|
| Quality (Grade) | 40% | | | |
| Token efficiency | 25% | | | |
| Cycle time | 20% | | | |
| Rework rate | 15% | | | |

Promote the winner as the new default for its task type.

### Step 7: Persist Optimization Results

Save the optimized prompt patterns and test results:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Prompt optimization cycle: Pattern '<name>' updated. Before: Grade <X>, <N> tokens. After: Grade <Y>, <M> tokens. Key change: <description>."
  tags: ["prompt-optimization", "few-shot", "ab-testing"]
```

Archive the full prompt template for future reference:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Prompt template v<N> for <task_type>: [template_content]. Few-shot examples: [example_ids]."
  tags: ["prompt-template", "few-shot-examples"]
```

### Step 8: Continuous Improvement Loop

Monitor prompt performance drift over time:
- If a promoted prompt's success rate drops >10% over 2 sprints, trigger re-optimization
- Rotate few-shot examples every 3 sprints to prevent staleness
- When new task types emerge, bootstrap from the closest existing prompt pattern
- Track the meta-metric: "sprints since last prompt regression"

## Output Format

```
Prompt Optimizer Report
=======================
Prompts Evaluated: <N>
Variants Generated: <N>
A/B Tests Completed: <N>

Performance Changes:
  <pattern_1>: Grade <old> → <new>, Tokens <old> → <new>
  <pattern_2>: Grade <old> → <new>, Tokens <old> → <new>

Few-Shot Pool:
  Examples Updated: <N>
  Examples Retired: <N>
  Pool Size: <N> per task type

Winners Promoted: <N>
  - <pattern_name> (task_type: <type>, improvement: <delta>%)

Token Savings: <N> tokens/task avg
Next Optimization: after sprint <N>
```

## Anti-Patterns

- Do NOT optimize prompts without baseline metrics — you cannot improve what you have not measured
- Do NOT A/B test with fewer than 4 tasks per variant — results will not be statistically meaningful
- Do NOT use Grade D task outputs as few-shot examples — they propagate bad patterns
- Do NOT over-optimize for token count at the expense of quality — quality always wins
- Do NOT keep few-shot examples longer than 3 sprints without re-evaluation — they go stale
- Do NOT apply the same prompt template to all task types — different types need different structures
- Do NOT ignore negative examples — explicitly showing what NOT to do is highly effective
