---
name: graph-nirvana-quality-guardian
description: Autonomous quality gates — code quality analysis, test generation, compliance scanning — with DORA tracking and auto-fix task creation
triggers:
  - graph-nirvana-quality-guardian
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nirvana-quality-guardian

Autonomous quality guardian that continuously monitors code quality, generates tests for uncovered paths, and scans for compliance issues. Unlike manual `graph-quality-assurance`, `graph-tests`, and `graph-security`, this skill is **proactive** — it triggers on every code change, maintains quality score trends, and auto-creates fix tasks in the graph.

Integrates into the MAPE-K loop: **Monitor** (detect changes) → **Analyze** (score quality) → **Plan** (prioritize fixes) → **Execute** (create tasks) → **Knowledge** (save trends).

## When to Use

- Automatically after any code change (commit, PR, branch push)
- When quality score trends are declining
- Before REVIEW or DEPLOY phase as a comprehensive quality gate
- When onboarding new modules or refactoring existing ones
- The user says "quality guardian", "auto quality", "continuous quality", or "nirvana quality"

## Mandatory Flow

```
detect_changes → lint_type_audit → code_quality_analysis → test_generation → coverage_gate → regression_detection → compliance_scan → auto_fix_tasks → report → write_memory
```

## Workflow

### Step 1: Monitor — Detect Code Changes

Identify modified files since last quality scan:

```bash
git diff --name-only HEAD~1 -- '*.ts' '*.tsx'
git diff --stat HEAD~1
```

Build change inventory:
- New files (need full analysis)
- Modified files (need delta analysis)
- Deleted files (check for orphaned tests/imports)

If no changes detected, skip to Step 9 (report cached score).

### Step 2: Auto-Lint & Type Safety Audit

Run lint + typecheck with trend tracking:

```bash
npm run lint 2>&1 | tail -20
npm run typecheck 2>&1 | tail -20
```

| Metric | Target | Scoring |
|--------|--------|---------|
| Lint errors | 0 | -10 per error |
| Lint warnings | ≤ threshold (9) | -2 per warning over threshold |
| TypeScript errors | 0 | -5 per error |
| `any` types in production | 0 | -10 per occurrence |
| `@ts-ignore` without approval | 0 | -15 per occurrence |

Compare against previous scan. Flag **regressions** (score decreased) as high priority.

### Step 3: Smart Code Quality Analysis

Analyze modified files against SOTA quality benchmarks:

| Dimension | Method | Threshold | Weight |
|-----------|--------|-----------|--------|
| SOLID adherence | Principle-by-principle check | ≥80/100 | 20% |
| DRY score | Duplicate block detection (>5 lines) | ≥90/100 | 15% |
| McCabe complexity | Decision point counting | All functions ≤10 | 20% |
| Code smells | Long functions, deep nesting, god classes | 0 high severity | 15% |
| Convention compliance | CLAUDE.md rules (kebab-case, ESM, Zod v4) | 100% adherence | 15% |
| Cognitive complexity | Nesting × branching heuristic | ≤15 per function | 15% |

Benchmarks: SonarQube "A" grade equivalence, Clean Code (Uncle Bob), SOLID (Martin).

### Step 4: Auto-Test Generation

Identify untested code paths in modified files:

1. Cross-reference modified files with `src/tests/*.test.ts`
2. For each untested public function:
   - Generate test skeleton (arrange-act-assert)
   - Include edge cases: null/undefined, empty arrays, boundary values
   - Follow project patterns: Vitest, factory functions, in-memory SQLite
3. For each modified function WITH existing tests:
   - Check if new code paths are covered
   - Suggest additional test cases for new branches

Output: list of test gaps with suggested test skeletons (do NOT auto-write — create as task nodes).

### Step 5: Test Coverage Gate

Run test suite and check coverage:

```bash
npm run test:coverage 2>&1 | tail -30
```

| Metric | Target (DORA) | Severity |
|--------|---------------|----------|
| Line coverage | ≥80% | required |
| Branch coverage | ≥70% | required |
| Function coverage | ≥85% | required |
| Critical path coverage | 100% | required |
| Coverage delta (vs. previous) | ≥0% (no regression) | required |

Use DORA metrics via `mcp__mcp-graph__forecast(mode:"dora")` for velocity context.

### Step 6: Regression Detection

Compare current test results against previous run:

| Check | Action |
|-------|--------|
| New test failures | Flag as **critical** — immediate fix required |
| Flaky tests (pass/fail inconsistency) | Flag as **high** — quarantine and fix |
| Coverage decrease | Flag as **medium** — add tests before merge |
| Performance regression (test duration +50%) | Flag as **low** — investigate |

Use `mcp__mcp-graph__search(query:"test regression")` to check for known patterns.

### Step 7: Compliance Scan

Continuous compliance checking across three domains:

**License Compliance (SPDX):**
```bash
npx license-checker --summary 2>/dev/null || echo "license-checker not installed"
```
- Flag copyleft licenses (GPL, AGPL) in production deps
- Verify SPDX identifiers in package.json

**Vulnerability Scan:**
```bash
npm audit --json 2>/dev/null | head -50
```
- Zero critical/high vulnerabilities (required)
- Low/moderate: track as tech debt nodes

**Convention Compliance:**
- ESM imports with `.js` extension
- Zod v4 imports from `'zod/v4'`
- No `console.log` in production code
- Typed errors (no raw `throw "string"`)

### Step 8: Auto-Fix Task Creation

For each issue found, create a task node in the graph:

```
Tool: mcp__mcp-graph__node
Params:
  action: add
  type: task
  name: "[Quality] <issue description>"
  description: "<details, file, line, suggested fix>"
  priority: <critical|high|medium|low>
  metadata: { "source": "nirvana-quality-guardian", "category": "<lint|type|solid|dry|complexity|test|compliance>" }
```

Link to parent epic via:
```
Tool: mcp__mcp-graph__edge
Params:
  from: <quality-epic-id>
  to: <new-task-id>
  type: "parent_of"
```

Priority sorting: critical → high → medium → low. Max 10 tasks per scan (avoid overwhelming the backlog).

### Step 9: Quality Report & Memory

Calculate overall quality score and save:

| Dimension | Weight | Score |
|-----------|--------|-------|
| Lint + Types | 20% | 0-100 |
| Code Quality (SOLID/DRY/Complexity) | 25% | 0-100 |
| Test Coverage | 20% | 0-100 |
| Regression Status | 15% | 0-100 |
| Compliance | 20% | 0-100 |

**Grades:** A (85-100), B (70-84), C (55-69), D (40-54), F (<40).

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Nirvana Quality Guardian — <date>"
  content: "<scores per dimension, overall grade, trend vs. previous, tasks created, top 3 issues>"
  tags: ["nirvana", "quality", "guardian", "dora", "compliance"]
```

## Output Format

```
Phase: NIRVANA QUALITY GUARDIAN (MAPE-K)
Changes Detected: N files modified, N new, N deleted
Lint + Types:    score/100 (N errors, N warnings, trend: ↑/↓/→)
Code Quality:    score/100 (SOLID: N, DRY: N, Complexity: N)
Test Coverage:   score/100 (line: N%, branch: N%, function: N%)
Regressions:     N critical, N high, N medium, N low
Compliance:      score/100 (licenses: ok/N issues, vulns: N, conventions: N)

Overall: score/100 — Grade X (trend: ↑/↓/→ vs. previous)
Tasks Created: N fix tasks in graph (N critical, N high, N medium)

Saved to memory: "Nirvana Quality Guardian — <date>"
```

## Anti-Patterns

- Do NOT create more than 10 fix tasks per scan — prioritize ruthlessly, avoid backlog flooding
- Do NOT auto-write test files — create task nodes with skeletons, let the developer implement
- Do NOT ignore compliance warnings — license issues compound and become legal risk
- Do NOT run without comparing against previous scan — trends matter more than absolute scores
- Do NOT skip regression detection — a passing suite with new failures is worse than a failing suite
- Do NOT relax thresholds to "pass" — fix the code, not the threshold
- Do NOT scan files outside the change set — focus on delta, not full codebase (use full scan periodically)
- Do NOT duplicate tasks — search graph for existing quality tasks before creating new ones
