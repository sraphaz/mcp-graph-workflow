# Harness Engineering Guide

> **Based on:** "Harness Engineering for Coding Agent Users" (Bockeler, Thoughtworks 2026)

## What is Harnessability?

**Harnessability** measures how well a codebase is structured to support effective AI agent assistance. A high harnessability score means the codebase has the structural properties that enable agents (like Claude, Copilot, etc.) to reliably understand, test, navigate, and modify the code.

The concept comes from the idea that a "harness" — like a safety harness — is what keeps an AI agent grounded in truth rather than hallucinating. Good harnesses are:

- **Type annotations** that give the agent precise contracts
- **Test files** that validate behavior and catch regressions
- **Architecture fitness functions** that prevent structural decay
- **Documentation** that explains intent, not just mechanics
- **Naming clarity** that makes code self-documenting
- **Typed error handling** that prevents silent failures
- **JSDoc coverage** that provides context density for exported functions

## The 7 Dimensions

The harnessability score is a composite of 7 dimensions:

| Dimension | Scanner | Weight | What it measures |
|-----------|---------|--------|-----------------|
| **Type Coverage** | `src/core/harness/type-coverage-scanner.ts` | **25%** | TypeScript files without `any` usage |
| **Test Coverage** | `src/core/harness/test-coverage-scanner.ts` | **25%** | Source modules that have a corresponding `.test.ts` file |
| **Architecture Fitness** | `src/core/harness/fitness-functions.ts` | **15%** | Dependency direction, circular deps, barrel integrity |
| **Docs Coverage** | `src/core/harness/docs-coverage-scanner.ts` | **15%** | Presence of CLAUDE.md, README, `.claude/rules/`, `docs/` |
| **Naming Clarity** | `src/core/harness/naming-clarity-scanner.ts` | **10%** | Descriptive variable/function names (no generic identifiers) |
| **Error Handling** | `src/core/harness/error-handling-scanner.ts` | **5%** | Typed errors, no swallowed catches, no `console.error` |
| **Context Density** | `src/core/harness/context-density-scanner.ts` | **5%** | JSDoc coverage on exported functions |

**Score formula:**
```
harnessability = typeScore * 0.25 + testScore * 0.25 + fitnessScore * 0.15
               + docsScore * 0.15 + namingScore * 0.10 + errorScore * 0.05
               + contextDensityScore * 0.05
```

## Grade Scale

| Grade | Score Range | Interpretation |
|-------|-------------|---------------|
| **A** | >= 85 | Excellent — agent-ready codebase |
| **B** | 70-84 | Good — minor gaps, agent assistance reliable |
| **C** | 55-69 | Fair — agent needs extra context, some risks |
| **D** | < 55 | Poor — high risk of agent hallucination/regression |

## Two "Test Coverage" Concepts — Do Not Confuse

This project has **two distinct test coverage mechanisms**. They measure different things and are NOT interchangeable:

| | `harness/test-coverage-scanner.ts` | `analyzer/test-coverage-checker.ts` |
|--|-------------------------------------|--------------------------------------|
| **What it measures** | Structural: does each `src/*.ts` module have a matching `.test.ts` file? | Quantitative: what % of lines/branches are executed by vitest? |
| **How it runs** | Static file-system analysis — no test execution | Runs vitest with `--coverage` flag |
| **Output** | Score 0-100 (ratio of modules with tests) | Coverage % (Istanbul/V8) |
| **Used by** | `analyze(mode: "harness_scan")` -> harness breakdown | `analyze(mode: "test_coverage")` -> CI quality gate |
| **Speed** | <100ms | Several seconds (runs test suite) |
| **Purpose** | Harness health metric | CI pass/fail gate |

**Practical impact:** A codebase can have harness test score = 95 (all modules have test files) but CI coverage = 40% (tests exist but don't cover many lines). Both matter but serve different purposes.

## Running the Scan

### Via MCP (recommended for agents)

```
analyze(mode: "harness_scan")
```

Returns:
```json
{
  "score": 82.5,
  "grade": "B",
  "breakdown": {
    "types":   { "score": 91, "weight": 0.25 },
    "tests":   { "score": 78, "weight": 0.25 },
    "fitness": { "score": 67, "weight": 0.15 },
    "docs":    { "score": 80, "weight": 0.15 },
    "naming":  { "score": 85, "weight": 0.10 },
    "errors":  { "score": 90, "weight": 0.05 },
    "context": { "score": 72, "weight": 0.05 }
  },
  "details": ["2 circular dependency violations in src/rag/", "..."],
  "timestamp": "2026-04-12T19:00:00.000Z"
}
```

### Via npm script (CLI)

```bash
npm run harness:scan
```

Runs `scripts/harness-scan-run.js` — full scan with human-readable output including per-dimension breakdown, violations, and grade.

## Architecture Fitness Functions

The **fitness dimension** (15%) checks 3 architectural rules:

### 1. Dependency Direction
`core/` must not import from `cli/`, `mcp/`, `api/`, or `web/`.
`schemas/` must not import from `core/`, `mcp/`, `cli/`, `api/`, or `web/`.

This enforces clean layered architecture. Violations are a strong signal of architectural decay.

### 2. Circular Dependencies
Detects import cycles between modules via DFS graph traversal. Cycles prevent tree-shaking and make the codebase fragile to refactoring.

### 3. Barrel Export Integrity
Each module's `index.ts` must re-export all sibling `.ts` files (excluding tests and benchmarks). Missing barrel exports are a common source of "where is this?" confusion for agents.

**Fitness score** = `(rules passing / 3) * 100`

## Naming Clarity

The **naming dimension** (10%) scans for poor identifier names across production TypeScript files (test files excluded):

- **Single-character variables** — flagged unless they are loop counters (`i`, `j`, `k`) or error parameters (`e`)
- **Generic names** — `data`, `result`, `item`, `obj`, `temp`, `val`, `res`, `info` are flagged as non-descriptive

**Score** = `(totalSymbols - flaggedSymbols) / totalSymbols * 100`

## Error Handling

The **error handling dimension** (5%) detects poor error patterns in production code (test files excluded for console checks):

- **Raw throws** — `throw new Error(...)` instead of typed errors from `src/core/utils/errors.ts`
- **Swallowed catches** — empty `catch {}` blocks that silently discard errors
- **Console.error/warn** — production code should use the project logger, not `console.error`

**Score** = `max(0, 100 - badSites * 20)` — each bad site costs 20 points

## Context Density

The **context density dimension** (5%) measures JSDoc coverage on exported functions (test/bench files excluded):

- A function is "documented" if it is preceded by a JSDoc closing (`*/`)
- Only exported functions are counted — internal helpers don't affect the score

**Score** = `(documentedExports / totalExports) * 100`

## Lifecycle Integration

The harness score is embedded throughout the mcp-graph lifecycle:

### Every MCP Tool Response

Every tool response includes harness data in the `_lifecycle` block:
```json
{
  "_lifecycle": {
    "harness": { "score": 82.5, "grade": "B" }
  }
}
```

Results are cached for 60 seconds per `(project, git_hash)` pair to avoid repeated scanning overhead.

### Phase Gate Checks

Harness scores are enforced at phase transitions:

| Gate | Requirement |
|------|-------------|
| `design_ready` | Harness score >= 55 |
| `validate_ready` | No regression > 10 points from baseline |
| `review_ready` | Grade >= C |
| `deploy_ready` | Grade >= B |
| `listening_ready` | Baseline snapshot saved for next cycle |

### Planner Integration

The `next` task recommender applies a +0.5 priority bonus to tasks that would improve weak harness dimensions. `plan_sprint` includes harness context, and sprint health tracking includes `harness_delta`.

## Issue Pattern Tracker — Automatic Rule Generation

`src/core/harness/issue-pattern-tracker.ts` tracks **recurring issues** detected during task completion (`finish-task` pipeline). When the same pattern appears 3+ times, it generates a suggested `.claude/rules/` entry.

### How it works

1. `finish-task` runs DoD checks on task completion
2. Detected issues (e.g., `missing_ac`, `status_skip`, `no_description`) are recorded in the `issue_patterns` SQLite table
3. When `count >= threshold` (default: 3), `getSuggestedRules()` generates a rule text
4. The rule appears in the `_issue_patterns` field of the `finish-task` response
5. Developer copies the suggested rule into `.claude/rules/` — closing the feedback loop

### Pattern types tracked

| Pattern | Triggered when |
|---------|---------------|
| `missing_ac` | Task has no acceptance criteria |
| `orphan_node` | Node has no parent or edges |
| `status_skip` | Task jumped to `done` without passing through `in_progress` |
| `circular_dep` | Circular dependency detected in graph |
| `oversized_task` | L/XL task with no subtasks |

### Suggested rule format

```markdown
# Rule: Always write acceptance criteria before starting implementation
Pattern: 3 tasks completed without AC in the last sprint.
Action: Before updating status to in_progress, verify AC exists.
```

## Advanced Features

### Harness Cache

`src/core/harness/harness-cache.ts` provides an in-memory + SQLite caching layer with 60-second TTL. Cache is automatically invalidated when the git hash changes, ensuring scores reflect the current codebase state.

### Trend Analysis

`src/core/harness/harness-trends.ts` tracks historical harness scores over time, enabling regression detection. When a score drops significantly between scans, warnings are surfaced in phase gate checks.

### Remediation Engine

`src/core/harness/remediation-engine.ts` suggests fixes for harness violations. When a dimension score drops, the engine provides actionable recommendations (e.g., "Add `.test.ts` for `src/core/rag/embedding-store.ts`" or "Replace `any` in `src/mcp/tools/context.ts:42`").

Additional remediation modules:
- `remediation-rules.ts` — rule definitions per violation type
- `remediation-suppression.ts` — allow-list for intentional violations
- `remediation-validator.ts` — validates that suggested fixes are applicable

### Sensor Fusion

`src/core/harness/sensor-fusion.ts` combines multiple data sources (harness scores, git history, test results, code churn) to build richer context for decision-making.

### Cross-Session Memory

`src/core/harness/cross-session-memory.ts` persists harness-related decisions across sessions, ensuring consistency between scan runs and preventing flip-flopping on remediation choices.

### Harness Preflight

`src/core/harness/harness-preflight.ts` runs lightweight preflight checks before phase transitions, warning about potential harness regressions before they block a gate.

### Pareto Priority

`src/core/harness/pareto-priority.ts` applies Pareto analysis to identify which files/modules would yield the biggest harness score improvement with the least effort.

## Improving Your Harnessability Score

| Dimension | Quick wins |
|-----------|-----------|
| **Type Coverage** | Replace `any` with specific types; enable `noImplicitAny` in tsconfig |
| **Test Coverage** | Add `.test.ts` for each `src/core/*.ts` module that lacks one |
| **Fitness** | Fix circular imports; add missing barrel re-exports in `index.ts` |
| **Docs** | Add entries to `.claude/rules/`; keep CLAUDE.md up to date |
| **Naming** | Rename `data`, `result`, `temp` to descriptive names reflecting their purpose |
| **Errors** | Replace `throw new Error(...)` with typed errors; never swallow catches |
| **Context Density** | Add JSDoc to exported functions, especially public APIs |

## Module Reference

| File | Purpose |
|------|---------|
| `src/core/harness/harnessability-score.ts` | Composite score calculator (7 dims) + grade computation |
| `src/core/harness/type-coverage-scanner.ts` | Scans for `any` usage in TypeScript files |
| `src/core/harness/test-coverage-scanner.ts` | Checks module -> test file structural match |
| `src/core/harness/docs-coverage-scanner.ts` | Checks presence of CLAUDE.md, README, rules, docs/ |
| `src/core/harness/fitness-functions.ts` | Dependency direction, circular deps, barrel integrity |
| `src/core/harness/naming-clarity-scanner.ts` | Detects generic/poor variable and function names |
| `src/core/harness/error-handling-scanner.ts` | Detects untyped errors, swallowed catches, console.error |
| `src/core/harness/context-density-scanner.ts` | Measures JSDoc coverage on exported functions |
| `src/core/harness/issue-pattern-tracker.ts` | Tracks recurring issues, generates `.claude/rules/` suggestions |
| `src/core/harness/harness-scan-runner.ts` | Orchestrates all 7 scanners + caching |
| `src/core/harness/harness-cache.ts` | In-memory + SQLite cache with 60s TTL |
| `src/core/harness/harness-trends.ts` | Historical score tracking + regression detection |
| `src/core/harness/harness-preflight.ts` | Preflight checks before phase transitions |
| `src/core/harness/harness-evolution.ts` | Evolution tracking across harness versions |
| `src/core/harness/remediation-engine.ts` | Suggests fixes for harness violations |
| `src/core/harness/remediation-rules.ts` | Rule definitions per violation type |
| `src/core/harness/remediation-suppression.ts` | Allow-list for intentional violations |
| `src/core/harness/remediation-validator.ts` | Validates suggested fixes are applicable |
| `src/core/harness/sensor-fusion.ts` | Multi-source context building |
| `src/core/harness/cross-session-memory.ts` | Persistent harness decisions across sessions |
| `src/core/harness/pareto-priority.ts` | Pareto analysis for maximum-impact improvements |
| `src/core/harness/violation-detail.ts` | Detailed violation information and formatting |
| `src/core/harness/index.ts` | Barrel exports for the harness module |
| `scripts/harness-scan-run.js` | Full scan runner (CLI entry point) |
