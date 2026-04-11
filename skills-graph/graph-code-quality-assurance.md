---
name: graph-code-quality-assurance
description: Autonomous code quality enforcement — runs static analysis, complexity checks, SOLID/DRY/KISS validation, and generates auto-refactoring tasks
triggers:
  - graph-code-quality-assurance
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-code-quality-assurance

Autonomous code quality enforcement for the mcp-graph codebase. Unlike `graph-quality-assurance` (manual audit triggered by user), this skill runs autonomously to continuously enforce quality standards. Uses Code Intelligence for symbol-level analysis, detects quality degradation in real time, auto-generates refactoring tasks in the graph, and tracks quality trends across sprints.

## When to Use

- Proactively triggered after every task marked `done` in IMPLEMENT phase
- When Code Intelligence detects complexity increase in modified modules
- When >3 tasks complete without any quality check in the current sprint
- After a refactoring epic completes to verify quality improvement
- The user says "enforce quality", "auto quality", "code quality assurance", or "continuous quality"
- Autonomously triggered when cumulative complexity score increases by >10% over baseline

## Mandatory Flow

```
scan(code_intelligence + lint + typecheck) → analyze(complexity + SOLID + DRY + KISS) → detect(degradation) → generate(refactoring tasks) → verify(quality trend) → write_memory
```

## Workflow

### Step 1: Scan — Collect Quality Signals

Run all static analysis tools and Code Intelligence to collect quality data:

```
Tool: mcp__mcp-graph__code_intelligence (action: "analyze")
```

Run project quality gates:
```bash
npm run lint
npm run typecheck
```

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Collect signals:

| Signal | Source | What It Measures |
|--------|--------|-----------------|
| Lint errors/warnings | `npm run lint` | Style and pattern violations |
| Type errors | `npm run typecheck` | Type safety violations |
| Symbol count per module | Code Intelligence | Module size/responsibility |
| Relationship density | Code Intelligence | Coupling between modules |
| Cyclomatic complexity | Code Intelligence + AST | Decision complexity per function |
| Import depth | Code Intelligence | Dependency chain length |
| Test coverage | Code Intelligence | Untested code paths |

### Step 2: Analyze — Quality Dimension Scoring

Score the codebase across quality dimensions:

**Complexity Analysis (McCabe + Cognitive):**

| Metric | Threshold | Score Impact |
|--------|-----------|-------------|
| Function complexity <= 5 | Low risk | +10 per function |
| Function complexity 6-10 | Moderate | 0 |
| Function complexity 11-20 | High | -10 per function |
| Function complexity > 20 | Critical | -25 per function, auto-generate task |
| File length > 300 lines | God module | -15 per file |
| Nesting depth > 3 | Deep nesting | -10 per occurrence |

**SOLID Principles Check:**

```
Tool: mcp__mcp-graph__code_intelligence (action: "search", query: "classes with >1 responsibility")
```

| Principle | Autonomous Detection Method |
|-----------|-----------------------------|
| **S** — Single Responsibility | Files with >3 distinct exported function categories |
| **O** — Open/Closed | Switch/if chains with >5 cases (should use polymorphism) |
| **L** — Liskov Substitution | Interface implementations that throw `NotImplementedError` |
| **I** — Interface Segregation | Interfaces with >7 methods |
| **D** — Dependency Inversion | Direct `new ClassName()` in business logic (should inject) |

**DRY Analysis:**

```
Tool: mcp__mcp-graph__search (query: "duplicated code patterns")
```

Detect duplication:
- Identical code blocks (>5 lines) across files
- Near-identical functions differing only in parameter names
- Repeated string literals without constants (>3 occurrences)
- Copy-paste patterns detectable by structural similarity

**KISS Validation:**

| Violation | Detection | Score Impact |
|-----------|-----------|-------------|
| Over-abstraction | >3 layers of indirection for simple operation | -10 |
| Premature generalization | Generic interface used by only 1 implementation | -5 |
| Complex configuration | Config objects with >10 fields for simple features | -5 |
| Unnecessary patterns | Design patterns applied where direct code is simpler | -10 |

### Step 3: Detect — Quality Degradation

Compare current scores against the last recorded baseline:

```
Tool: mcp__mcp-graph__rag_context (query: "code quality baseline metrics")
```

Degradation detection:

| Comparison | Threshold | Alert Level |
|-----------|-----------|-------------|
| Overall score dropped >5 points | Single sprint | Warning |
| Overall score dropped >10 points | Single sprint | Critical |
| Any dimension dropped >15 points | Single sprint | Critical — auto-generate task |
| Complexity trend increasing 3+ sprints | Trend | Architectural review needed |
| New lint errors introduced | Any | Block until fixed |

### Step 4: Generate — Create Refactoring Tasks

For each critical quality issue detected, auto-generate a refactoring task in the graph:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "task"
  title: "Refactor: <module> — <quality issue>"
  description: "Quality issue detected by autonomous QA.\n\nProblem: <description>\nCurrent score: <N>\nTarget score: <N>\n\nAcceptance Criteria:\n- [ ] Complexity reduced to <threshold>\n- [ ] All lint errors resolved\n- [ ] Tests passing\n- [ ] No functional regression"
  priority: "<based on severity>"
  tags: ["refactoring", "quality", "auto-generated"]
```

Link to the current sprint or create a quality epic:
```
Tool: mcp__mcp-graph__edge (from: "<quality_epic>", to: "<refactoring_task>", type: "parent_of")
```

Prioritization of auto-generated tasks:

| Severity | Priority | Sprint Placement |
|----------|----------|-----------------|
| Critical (complexity >20, SOLID violation) | High | Current sprint |
| High (complexity 11-20, DRY violation) | Medium | Next sprint |
| Medium (KISS violation, minor DRY) | Low | Backlog |

### Step 5: Verify — Quality Trend Analysis

Track quality over time to verify improvement:

```
Tool: mcp__mcp-graph__metrics
```

Calculate quality velocity: `quality_delta = current_score - previous_score` per sprint.

| Trend | Interpretation | Action |
|-------|---------------|--------|
| Improving (delta > +3) | Quality investments paying off | Continue current strategy |
| Stable (delta -3 to +3) | Maintaining quality | Monitor for emerging issues |
| Declining (delta < -3) | Tech debt accumulating | Increase refactoring allocation |
| Rapidly declining (delta < -10) | Quality crisis | Pause features, dedicate sprint to quality |

### Step 6: Record Quality State

Save the comprehensive quality report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Code Quality Report — <date>"
  content: "<dimension scores, degradation alerts, auto-generated tasks, trend analysis>"
  tags: ["quality", "autonomous", "code-quality", "solid", "complexity"]
```

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

## Output Format

```
Phase: AUTONOMOUS CODE QUALITY ASSURANCE
Loop: Scan -> Analyze -> Detect -> Generate -> Verify

Scan:
  Lint: <N> errors, <N> warnings
  Type safety: <N> errors
  Symbols analyzed: <N> across <N> modules

Analyze:
  Complexity: <N>/100 (<N> functions > 10, <N> functions > 20)
  SOLID: <N>/100 (<N> violations: S=<N> O=<N> L=<N> I=<N> D=<N>)
  DRY: <N>/100 (<N> duplications found)
  KISS: <N>/100 (<N> over-abstractions)
  Overall: <N>/100 — Grade <A-F>

Detect:
  Degradation: <none/warning/critical>
  Trend: <improving/stable/declining> (delta: <+/-N>)

Generate:
  Refactoring tasks created: <N>
  Critical: <N> | High: <N> | Medium: <N>

Verify:
  Quality velocity: <+/-N> per sprint
  Recommendation: <continue/increase refactoring/quality sprint needed>

Saved to memory: "Code Quality Report — <date>"
```

## Anti-Patterns

- Do NOT confuse this with `graph-quality-assurance` (manual audit) — this is autonomous and continuous
- Do NOT auto-generate more than 5 refactoring tasks per cycle — keep WIP manageable
- Do NOT set complexity thresholds lower than 10 — some complexity is inherent and unavoidable
- Do NOT enforce SOLID dogmatically on utility modules — SOLID applies to domain/business logic
- Do NOT skip trend analysis — point-in-time scores are less useful than trends
- Do NOT block feature work for minor quality issues — only critical issues warrant sprint interruption
- Do NOT delete auto-generated tasks without reviewing them — they represent real quality signals
