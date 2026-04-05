---
name: graph-dx
description: Developer Experience audit using DX Core 4 framework, SPACE metrics, cognitive load assessment, onboarding speed measurement, and error message quality analysis
triggers:
  - graph-dx
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-dx

Developer Experience audit using DX Core 4 framework, SPACE metrics, cognitive load assessment, onboarding speed measurement, and error message quality analysis. Measures developer productivity holistically across speed, effectiveness, quality, and impact dimensions.

## When to Use

- When onboarding new developers
- Quarterly DX reviews
- When developer satisfaction drops
- When evaluating tooling changes
- During LISTENING phase for process improvement

## Mandatory Flow

```
DX Core 4 assessment -> cognitive load audit -> onboarding evaluation -> error message quality -> tooling audit -> documentation check -> feedback collection -> report -> write_memory
```

## Workflow

### Step 1: DX Core 4 Assessment

Evaluate the 4 dimensions from the getdx.com framework:

| Dimension | Question | What to Measure |
|-----------|----------|-----------------|
| **Speed** | How fast can devs ship? | Build time, test time, deploy frequency, PR merge time, DORA metrics (deployment frequency, lead time for changes) |
| **Effectiveness** | Does the code work correctly? | Test pass rate, bug escape rate, rollback frequency, production incident rate |
| **Quality** | Is the code maintainable? | Code complexity, tech debt ratio, test coverage, linting violations, type safety coverage |
| **Impact** | Does the work matter? | Feature adoption rate, user-facing value per sprint, alignment with roadmap, wasted work ratio |

Score each dimension 1-10 based on DORA metrics and developer workflow analysis. Use `mcp__mcp-graph__metrics` to pull velocity and throughput data from the execution graph.

### Step 2: Cognitive Load Audit

Measure cognitive load per task using Miller's Law (7 +/- 2 items in working memory):

- How many files must a developer understand to make a change?
- How deep is the dependency chain for typical modifications?
- How many concepts must be held in working memory simultaneously?
- Are module boundaries clear or do concerns bleed across layers?

Flag modules requiring >7 concepts (Miller's Law threshold).

Check CLAUDE.md completeness -- it reduces cognitive load for AI pair programming:
- Does CLAUDE.md cover all conventions?
- Are path-specific rules documented in `.claude/rules/`?
- Can a new AI agent produce correct code from CLAUDE.md alone?

### Step 3: Onboarding Speed

Measure time-to-first-commit for new developers. Check each onboarding gate:

| Gate | Check | Score |
|------|-------|-------|
| Setup | README has setup instructions (`npm install` + `npm run dev` works) | 0-2 |
| Conventions | CLAUDE.md covers coding conventions and patterns | 0-2 |
| Examples | Example tests exist for each test level (unit, integration, E2E) | 0-2 |
| Reproducibility | Dev environment reproducible without tribal knowledge | 0-2 |
| First Task | Can a new dev complete a small task within 2 hours? | 0-2 |

Score onboarding friction 1-10 (lower is better). Flag any step requiring undocumented tribal knowledge.

### Step 4: Error Message Quality

Audit error messages in `src/core/utils/errors.ts` and across the codebase.

Good error messages must:
- Describe **what** went wrong (specific, not generic)
- Suggest **how to fix** the issue (actionable next step)
- Include **relevant context** (IDs, values, file paths)

Bad error patterns to flag:
- `"Something went wrong"` -- no context
- Raw stack traces exposed to users -- information leak
- Missing error context (no IDs, no values)
- Catch-all error handlers that swallow details
- Errors without typed error classes (raw `throw new Error()`)

Score error quality as percentage of errors meeting all 3 criteria.

### Step 5: Tooling Audit

Evaluate developer tools against industry benchmarks:

| Tool | Metric | Target | How to Measure |
|------|--------|--------|----------------|
| Build | `npm run build` time | <10s | `time npm run build` |
| Tests | `npm test` time | <30s | `time npm test` |
| Lint | `npm run lint` time | <5s | `time npm run lint` |
| Hot Reload | Available? | Yes | Check for `tsx --watch` or similar |
| Debug | Config exists? | Yes | Check `.vscode/launch.json` or equivalent |
| IDE | Integration complete? | Yes | Check tsconfig paths, ESLint config, editor settings |

Compare with industry benchmarks. Flag any tool exceeding 2x the target time.

### Step 6: Documentation Health

Check documentation completeness and freshness:

| Doc | Check | Score |
|-----|-------|-------|
| CLAUDE.md | Up-to-date with current conventions | 0-2 |
| README | Covers setup, test, deploy | 0-2 |
| API docs | Public endpoints documented | 0-2 |
| ADRs | Architectural decisions recorded | 0-2 |
| Inline comments | Complex logic annotated | 0-2 |

Use `mcp__mcp-graph__analyze(mode:"doc_completeness")` for graph-tracked documentation coverage.

### Step 7: Feedback Collection

Gather developer pain points through structured questions:

- What slows you down the most in the daily workflow?
- What is confusing or poorly documented?
- What would you change about the tooling or process?
- Where do you encounter the most friction?

Create graph nodes for each improvement item identified:
```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "task"
  title: "DX Improvement: <description>"
  tags: ["dx-improvement"]
```

### Step 8: DX Report

Generate comprehensive DX report with all scores:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "DX Audit — <date>"
  content: "<DX Core 4 scores, cognitive load, onboarding, error quality, tooling, docs, improvements>"
  tags: ["dx", "audit", "developer-experience", "metrics"]
```

## Output Format

```
Phase: DX AUDIT
DX Core 4 Scores:
  Speed: N/10
  Effectiveness: N/10
  Quality: N/10
  Impact: N/10
Cognitive Load Score: N/10 (N modules above Miller's Law threshold)
Onboarding Friction: N/10
Error Message Quality: N% meeting all 3 criteria
Tooling Score: N/10 (build Ns, test Ns, lint Ns)
Documentation Health: N%
Top 5 DX Improvements:
  1. <improvement>
  2. <improvement>
  3. <improvement>
  4. <improvement>
  5. <improvement>
Overall Grade: A/B/C/D/F

Saved to memory: "DX Audit — <date>"
```

## Anti-Patterns

- Do NOT optimize DX based on gut feeling -- measure first
- Do NOT ignore cognitive load -- it is the #1 productivity killer
- Do NOT skip onboarding evaluation -- it reveals systemic issues
- Do NOT accept "works on my machine" -- reproducibility is DX
- Do NOT forget CLAUDE.md -- it is the AI pair programmer's onboarding doc
- Do NOT measure only speed -- quality and impact matter equally
