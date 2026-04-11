---
name: graph-adaptive-learning
description: Continuous adaptive learning from task executions — learns from outcomes, error patterns, and successful strategies to improve planning and execution
triggers:
  - graph-adaptive-learning
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-adaptive-learning

Continuous adaptive learning from execution graph outcomes. Autonomously analyzes completed tasks, error patterns, successful strategies, and estimation accuracy to build a feedback loop that improves future planning and execution. Implements a reinforcement-style learning cycle: observe outcomes, extract patterns, update strategies, verify improvement.

## When to Use

- Proactively triggered after every sprint completion (all sprint tasks done)
- When >5 tasks have been completed since the last learning cycle
- When estimation accuracy drops below 70% (actual vs. estimated effort)
- After a self-healing cycle to learn from the errors that were fixed
- The user says "learn from history", "adaptive learning", "improve estimates", or "pattern analysis"
- Autonomously triggered when the same error pattern appears in 3+ distinct tasks

## Mandatory Flow

```
observe(completed tasks + outcomes) → extract(patterns + correlations) → update(strategies + estimates) → verify(prediction accuracy) → write_memory
```

## Workflow

### Step 1: Observe — Collect Task Outcomes

Gather data from recently completed tasks for analysis:

```
Tool: mcp__mcp-graph__search (query: "status:done")
```

```
Tool: mcp__mcp-graph__metrics
```

For each completed task since last learning cycle, collect:

| Data Point | Source | Purpose |
|------------|--------|---------|
| Estimated size vs. actual cycle time | Task metadata | Estimation accuracy |
| Number of status changes | Status history | Rework indicator |
| Times blocked and reasons | Status history | Blocker patterns |
| Dependencies satisfied on time? | Edge analysis | Dependency reliability |
| Test pass/fail on first attempt | Task notes | Quality patterns |
| Error patterns encountered | Memory entries | Recurring issues |

```
Tool: mcp__mcp-graph__rag_context (query: "errors encountered during implementation")
```

### Step 2: Extract — Pattern Recognition

Analyze the collected data to identify actionable patterns:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Pattern categories to extract:

**Estimation Patterns:**

| Pattern | Signal | Learning |
|---------|--------|----------|
| Consistent underestimation | >60% tasks take longer than estimated | Apply multiplier to future estimates |
| Type-specific bias | UI tasks 2x estimated, backend tasks on target | Adjust by task type |
| Size-correlated error | L/XL tasks always underestimated, S/XS accurate | Decompose large tasks more aggressively |
| First-in-domain penalty | First task in new module takes 3x longer | Add ramp-up buffer for new domains |

**Error Patterns:**

| Pattern | Signal | Learning |
|---------|--------|----------|
| Recurring import errors | Same ESM/Zod import issue in 3+ tasks | Create pre-implementation checklist item |
| Test setup failures | Common test infrastructure issues | Improve test factory/setup documentation |
| Dependency surprises | Tasks blocked by undeclared dependencies | Improve dependency discovery in PLAN phase |
| Integration failures | Cross-module issues at composition time | Add integration test requirement for cross-module tasks |

**Success Patterns:**

| Pattern | Signal | Learning |
|---------|--------|----------|
| TDD-first tasks complete faster | Tasks with tests written first have 30% lower cycle time | Reinforce TDD discipline |
| Small batch sizes | Tasks sized S/XS have higher completion rate | Prefer smaller task decomposition |
| Context loading | Tasks using `context` + `rag_context` have fewer blockers | Always load context before implementation |

### Step 3: Update — Apply Learned Strategies

Update planning and execution strategies based on extracted patterns:

**Update estimation model:**
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Estimation Model — Updated <date>"
  content: "<estimation multipliers by task type, size adjustment factors, domain ramp-up buffers>"
  tags: ["learning", "estimation", "model"]
```

**Update error prevention checklist:**
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Error Prevention Checklist — Updated <date>"
  content: "<pre-implementation checks derived from recurring error patterns>"
  tags: ["learning", "errors", "prevention", "checklist"]
```

**Update task decomposition rules:**
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Decomposition Rules — Updated <date>"
  content: "<size thresholds, when to decompose, type-specific guidelines>"
  tags: ["learning", "decomposition", "planning"]
```

**Feed back into active planning:**
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

If the current sprint has tasks that match known problematic patterns, flag them:
- Tasks matching underestimation patterns: recommend re-estimation
- Tasks in domains with first-in-domain penalty: add buffer
- Tasks without pre-implementation checklist items: add them

### Step 4: Verify — Measure Learning Effectiveness

Compare current sprint performance against previous sprints to verify that learned strategies are improving outcomes:

```
Tool: mcp__mcp-graph__metrics
```

```
Tool: mcp__mcp-graph__forecast (mode: "velocity")
```

Verification metrics:

| Metric | Improving? | Target |
|--------|-----------|--------|
| Estimation accuracy | Current vs. previous sprint | >75% within 20% of actual |
| First-attempt pass rate | Tasks passing tests on first try | >80% |
| Blocker frequency | Tasks getting blocked per sprint | Decreasing trend |
| Cycle time variance | Std deviation of cycle times | Decreasing trend |
| Rework rate | Tasks requiring status regression | <10% |

If metrics are not improving after 2 learning cycles, escalate: the learning model may need human review.

### Step 5: Record Learning Cycle

Save the complete learning cycle results:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Adaptive Learning Cycle — <date>"
  content: "<patterns observed, strategies updated, verification results, learning effectiveness>"
  tags: ["adaptive-learning", "cycle", "patterns", "improvement"]
```

Include a confidence score for each extracted pattern:
- **High confidence (>80%):** Pattern observed in >5 tasks with consistent signal
- **Medium confidence (50-80%):** Pattern observed in 3-5 tasks
- **Low confidence (<50%):** Pattern observed in <3 tasks (keep observing, do not act yet)

## Output Format

```
Phase: ADAPTIVE LEARNING
Loop: Observe -> Extract -> Update -> Verify

Observe:
  Tasks analyzed: <N> (since last cycle)
  Total cycle time: <N>h | Avg: <N>h
  Estimation accuracy: <N>%

Extract:
  Patterns found: <N>
  Estimation patterns: <N> (high confidence: <N>)
  Error patterns: <N> (recurring: <N>)
  Success patterns: <N>

Update:
  Estimation model: <updated/unchanged>
  Error checklist: <N> new items added
  Decomposition rules: <updated/unchanged>
  Active tasks flagged: <N>

Verify:
  Estimation accuracy trend: <improving/stable/declining>
  First-attempt pass rate: <N>% (target: 80%)
  Blocker frequency: <N>/sprint (trend: <up/down/stable>)
  Learning effectiveness: <high/medium/low>

Saved to memory:
  - "Adaptive Learning Cycle — <date>"
  - "Estimation Model — Updated <date>"
  - "Error Prevention Checklist — Updated <date>"
```

## Anti-Patterns

- Do NOT learn from a single task outcome — require patterns across 3+ tasks before updating strategies
- Do NOT update estimation multipliers by more than 50% in a single cycle — gradual adjustments prevent overreaction
- Do NOT discard old patterns without evidence they are obsolete — mark as low-confidence instead
- Do NOT apply learned strategies retroactively to already-in-progress tasks — only to future tasks
- Do NOT skip the verify step — unverified learning may introduce bias
- Do NOT learn from outlier tasks (e.g., blocked by external factors) — filter for normal execution conditions
- Do NOT treat all task types as homogeneous — always segment patterns by task type, size, and domain
