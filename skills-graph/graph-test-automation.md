---
name: graph-test-automation
description: Autonomous test generation and execution — detects untested code, generates test skeletons, runs suites, reports coverage, and creates testing tasks
triggers:
  - graph-test-automation
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-test-automation

Autonomous test generation and execution for the mcp-graph codebase. Unlike `graph-tests` (manual test strategy and TDD workflow), this skill autonomously detects untested code paths, generates test skeletons following project conventions, executes test suites, reports coverage, and creates graph tasks for uncovered areas. Enforces the project's TDD-first methodology even when developers forget.

## When to Use

- Proactively triggered after every task marked `done` to verify test coverage
- When Code Intelligence detects new public functions without corresponding test files
- When test coverage drops below 80% for any modified module
- After a refactoring task completes to verify no tests were broken or removed
- The user says "auto test", "generate tests", "test automation", or "coverage check"
- Autonomously triggered when >5 public functions exist without tests across the codebase

## Mandatory Flow

```
discover(code_intelligence + coverage) → analyze(untested paths) → generate(test skeletons) → execute(run tests) → report(coverage + results) → create_tasks(graph nodes for gaps) → write_memory
```

## Workflow

### Step 1: Discover — Map Code to Tests

Use Code Intelligence to map all public symbols to their test files:

```
Tool: mcp__mcp-graph__code_intelligence (action: "analyze")
```

Build the code-to-test mapping:

| Source File | Public Symbols | Test File | Coverage Status |
|------------|---------------|-----------|-----------------|
| `src/core/X/Y.ts` | `functionA`, `functionB` | `src/tests/X/Y.test.ts` | Exists/Missing |

Run the test suite with coverage:
```bash
npm run test:coverage
```

Extract coverage data:

| Metric | Current | Threshold |
|--------|---------|-----------|
| Statement coverage | Measured | >80% |
| Branch coverage | Measured | >75% |
| Function coverage | Measured | >85% |
| Line coverage | Measured | >80% |

### Step 2: Analyze — Identify Untested Code Paths

Cross-reference Code Intelligence symbols with test coverage:

```
Tool: mcp__mcp-graph__code_intelligence (action: "search", query: "exported functions")
```

Classify untested code:

| Category | Detection Method | Priority |
|----------|-----------------|----------|
| Public function with no test file | Code Intelligence: no test file references symbol | Critical |
| Function with test but <50% branch coverage | Coverage report: branch coverage per function | High |
| Error path not tested | Code Intelligence: catch blocks with no test | High |
| Edge case not covered | Branch analysis: conditional branches without tests | Medium |
| Integration point untested | Cross-module calls with no integration test | High |
| New function added since last test run | Git diff + Code Intelligence | Critical |

Rank untested paths by risk:
- `risk = (usage_count * dependency_depth * complexity) / existing_coverage`
- Higher risk = more likely to cause production issues if broken

### Step 3: Generate — Create Test Skeletons

For each untested path (sorted by risk), generate a test skeleton following project conventions:

Test skeleton template (Vitest + Arrange-Act-Assert):

```typescript
import { describe, it, expect } from 'vitest';
import { targetFunction } from '../core/module/file.js';

describe('targetFunction', () => {
  it('should <expected behavior for happy path>', () => {
    // Arrange
    const input = /* minimal valid input */;
    
    // Act
    const result = targetFunction(input);
    
    // Assert
    expect(result).toEqual(/* expected output */);
  });

  it('should <expected behavior for edge case>', () => {
    // Arrange
    const input = /* edge case input */;
    
    // Act
    const result = targetFunction(input);
    
    // Assert
    expect(result).toEqual(/* expected output */);
  });

  it('should throw <ErrorType> when <invalid condition>', () => {
    // Arrange
    const input = /* invalid input */;
    
    // Act & Assert
    expect(() => targetFunction(input)).toThrow(/* ErrorType */);
  });
});
```

Generation rules:
- Use factory functions for test data, not large mock objects
- Use in-memory SQLite (`:memory:`) for store tests
- Follow naming convention: `it('should <verb> <expected behavior>')`
- Include happy path, edge cases, and error cases
- Import from `.js` extensions (ESM convention)
- Use `zod/v4` for any schema validation in tests

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 4: Execute — Run Test Suites

Run the full test suite to verify generated tests and existing tests:

```bash
npm test
```

If tests fail, categorize failures:

| Failure Type | Action |
|-------------|--------|
| Generated test has wrong assertion | Fix the assertion based on actual behavior |
| Generated test has wrong import | Fix the import path (ESM `.js` extension) |
| Existing test broke by refactoring | Flag as regression — create urgent task |
| Flaky test (passes on retry) | Flag for stabilization task |
| Timeout | Increase timeout or investigate slow setup |

Run with coverage to measure improvement:
```bash
npm run test:coverage
```

### Step 5: Report — Coverage and Results Summary

Compile the test execution report:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Coverage comparison:

| Module | Before | After | Delta | Status |
|--------|--------|-------|-------|--------|
| `core/store` | N% | N% | +N% | Improved |
| `core/parser` | N% | N% | 0% | Unchanged |
| `core/rag` | N% | N% | -N% | Regressed |

Test results summary:

| Suite | Total | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Unit | N | N | N | N |
| Integration | N | N | N | N |
| E2E | N | N | N | N |

### Step 6: Create Tasks — Graph Nodes for Coverage Gaps

For modules still below threshold after test generation, create testing tasks:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "task"
  title: "Test: <module> — increase coverage from <N>% to <target>%"
  description: "Untested code paths identified by autonomous test automation.\n\nUntested functions:\n- <function1> (risk: <high/medium>)\n- <function2> (risk: <high/medium>)\n\nAcceptance Criteria:\n- [ ] Function coverage >= <target>%\n- [ ] Branch coverage >= <target>%\n- [ ] All error paths tested\n- [ ] npm test passes with zero failures"
  priority: "<based on risk>"
  tags: ["testing", "coverage", "auto-generated"]
```

```
Tool: mcp__mcp-graph__edge (from: "<testing_epic>", to: "<test_task>", type: "parent_of")
```

### Step 7: Record Automation Results

Save the test automation report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Test Automation Report — <date>"
  content: "<discovery results, tests generated, execution results, coverage deltas, tasks created>"
  tags: ["test-automation", "coverage", "auto-generated", "tdd"]
```

## Output Format

```
Phase: AUTONOMOUS TEST AUTOMATION
Loop: Discover -> Analyze -> Generate -> Execute -> Report -> Create Tasks

Discover:
  Public symbols: <N> across <N> modules
  Test files: <N> existing
  Coverage: statements <N>%, branches <N>%, functions <N>%, lines <N>%

Analyze:
  Untested functions: <N> (critical: <N>, high: <N>, medium: <N>)
  Highest risk: <function> in <module> (risk score: <N>)

Generate:
  Test skeletons created: <N>
  Test cases generated: <N> (happy path: <N>, edge case: <N>, error: <N>)

Execute:
  Tests run: <N> | Passed: <N> | Failed: <N> | Skipped: <N>
  Coverage delta: statements <+/-N>%, branches <+/-N>%, functions <+/-N>%

Report:
  Modules improved: <N>
  Modules below threshold: <N>

Tasks Created: <N> testing tasks in graph

Saved to memory: "Test Automation Report — <date>"
```

## Anti-Patterns

- Do NOT confuse this with `graph-tests` (manual TDD workflow) — this is autonomous test generation
- Do NOT generate tests that test implementation details — test behavior and public API only
- Do NOT create massive mock datasets in generated tests — use minimal factory functions
- Do NOT skip running generated tests — untested test skeletons are worse than no tests (false confidence)
- Do NOT auto-generate tests for trivial getters/setters — focus on business logic and error paths
- Do NOT generate more than 20 test files per cycle — review and iterate
- Do NOT remove existing tests to increase coverage percentage — that is gaming the metric
