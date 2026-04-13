# Harness Engineering Guide

> **Based on:** "Harness Engineering for Coding Agent Users" (Böckeler, Thoughtworks 2026)

## What is Harnessability?

**Harnessability** measures how well a codebase is structured to support effective AI agent assistance. A high harnessability score means the codebase has the structural properties that enable agents (like Claude, Copilot, etc.) to reliably understand, test, navigate, and modify the code.

The concept comes from the idea that a "harness" — like a safety harness — is what keeps an AI agent grounded in truth rather than hallucinating. Good harnesses are:

- **Type annotations** that give the agent precise contracts
- **Test files** that validate behavior and catch regressions
- **Architecture fitness functions** that prevent structural decay
- **Documentation** that explains intent, not just mechanics

## The 4 Dimensions

The harnessability score is a composite of 4 dimensions:

| Dimension | Scanner | Weight | What it measures |
|-----------|---------|--------|-----------------|
| **Type Coverage** | `src/core/harness/type-coverage-scanner.ts` | **30%** | TypeScript files without `any` usage |
| **Test Coverage** | `src/core/harness/test-coverage-scanner.ts` | **30%** | Source modules that have a corresponding `.test.ts` file |
| **Architecture Fitness** | `src/core/harness/fitness-functions.ts` | **20%** | Dependency direction, circular deps, barrel integrity |
| **Docs Coverage** | `src/core/harness/docs-coverage-scanner.ts` | **20%** | Presence of CLAUDE.md, README, `.claude/rules/`, `docs/` |

**Score formula:**
```
harnessability = typeScore × 0.30 + testScore × 0.30 + fitnessScore × 0.20 + docsScore × 0.20
```

## Grade Scale

| Grade | Score Range | Interpretation |
|-------|-------------|---------------|
| **A** | ≥ 85 | Excellent — agent-ready codebase |
| **B** | 70–84 | Good — minor gaps, agent assistance reliable |
| **C** | 55–69 | Fair — agent needs extra context, some risks |
| **D** | < 55 | Poor — high risk of agent hallucination/regression |

## ⚠️ Two "Test Coverage" Concepts — Do Not Confuse

This project has **two distinct test coverage mechanisms**. They measure different things and are NOT interchangeable:

| | `harness/test-coverage-scanner.ts` | `analyzer/test-coverage-checker.ts` |
|--|-------------------------------------|--------------------------------------|
| **What it measures** | Structural: does each `src/*.ts` module have a matching `.test.ts` file? | Quantitative: what % of lines/branches are executed by vitest? |
| **How it runs** | Static file-system analysis — no test execution | Runs vitest with `--coverage` flag |
| **Output** | Score 0–100 (ratio of modules with tests) | Coverage % (Istanbul/V8) |
| **Used by** | `analyze(mode: "harness_scan")` → harness breakdown | `analyze(mode: "test_coverage")` → CI quality gate |
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
    "typeCoverage": { "score": 91, "weight": 0.3 },
    "testCoverage": { "score": 78, "weight": 0.3 },
    "architectureFitness": { "score": 67, "weight": 0.2 },
    "docsCoverage": { "score": 80, "weight": 0.2 }
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

The **fitness dimension** (20%) checks 3 architectural rules:

### 1. Dependency Direction
`core/` must not import from `cli/`, `mcp/`, `api/`, or `web/`.
`schemas/` must not import from `core/`, `mcp/`, `cli/`, `api/`, or `web/`.

This enforces clean layered architecture. Violations are a strong signal of architectural decay.

### 2. Circular Dependencies
Detects import cycles between modules via DFS graph traversal. Cycles prevent tree-shaking and make the codebase fragile to refactoring.

### 3. Barrel Export Integrity
Each module's `index.ts` must re-export all sibling `.ts` files (excluding tests and benchmarks). Missing barrel exports are a common source of "where is this?" confusion for agents.

**Fitness score** = `(rules passing / 3) × 100`

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

## Improving Your Harnessability Score

| Dimension | Quick wins |
|-----------|-----------|
| **Type Coverage** | Replace `any` with specific types; enable `noImplicitAny` in tsconfig |
| **Test Coverage** | Add `.test.ts` for each `src/core/*.ts` module that lacks one |
| **Fitness** | Fix circular imports; add missing barrel re-exports in `index.ts` |
| **Docs** | Add entries to `.claude/rules/`; keep CLAUDE.md up to date |

## Module Reference

| File | Purpose |
|------|---------|
| `src/core/harness/harnessability-score.ts` | Composite score calculator + grade computation |
| `src/core/harness/type-coverage-scanner.ts` | Scans for `any` usage in TypeScript files |
| `src/core/harness/test-coverage-scanner.ts` | Checks module→test file structural match |
| `src/core/harness/docs-coverage-scanner.ts` | Checks presence of CLAUDE.md, README, rules, docs/ |
| `src/core/harness/fitness-functions.ts` | Dependency direction, circular deps, barrel integrity |
| `src/core/harness/issue-pattern-tracker.ts` | Tracks recurring issues, generates `.claude/rules/` suggestions |
| `scripts/harness-scan-run.js` | Full scan runner (CLI entry point) |
