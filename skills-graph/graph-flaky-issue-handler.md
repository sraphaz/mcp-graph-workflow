---
name: graph-flaky-issue-handler
description: Detects, diagnoses, quarantines, and eliminates flaky tests using statistical analysis and deterministic strategies
triggers:
  - graph-flaky-issue-handler
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-flaky-issue-handler

Autonomous skill for detecting, diagnosing, quarantining, and eliminating flaky tests across the project. Uses statistical flakiness detection (Chi-squared test for independence between test outcome and environment), smart retry with exponential backoff, automatic quarantine tagging, and deterministic replacement strategies. Tracks a Flakiness Budget metric per module to enforce zero-tolerance thresholds.

## When to Use

- When a test suite has intermittent failures that cannot be reproduced on demand
- When CI pipelines are red due to non-deterministic test outcomes
- When the team suspects timing, ordering, or shared-state issues in tests
- When flaky test count exceeds the Flakiness Budget threshold for a module
- When onboarding new test infrastructure and need to baseline reliability
- When a previously stable test begins failing sporadically after a dependency change

## Mandatory Flow

```
search(flaky candidates) → analyze(flakiness_detection) → node(quarantine) → metrics(flakiness_budget) → [diagnose root cause] → [apply deterministic fix] → analyze(validate_fix) → write_memory
```

## Workflow

### Step 1: Identify Flaky Candidates

Search the graph and test history for tests exhibiting non-deterministic behavior. A test is a flaky candidate if it has failed at least once and passed at least once within the last N runs without any code change.

- `Tool: mcp__mcp-graph__search` — query test nodes with mixed pass/fail history
- Collect test identifiers, failure timestamps, error messages, and environment metadata
- Build a candidate list sorted by failure frequency (highest first)

### Step 2: Statistical Flakiness Detection

Apply Chi-squared test for independence to determine whether test outcome is statistically independent of the code under test (i.e., the failure is environmental/non-deterministic).

| Metric | Formula | Threshold |
|--------|---------|-----------|
| Chi-squared statistic | sum((O-E)^2/E) across pass/fail x environment cells | p < 0.05 = flaky |
| Flakiness Rate | failures / total_runs over rolling window | > 5% = candidate |
| Flakiness Score | weighted(frequency, recency, blast_radius) | 0-100, quarantine at 70+ |

- `Tool: mcp__mcp-graph__analyze` — mode: `flakiness_detection`, pass test node IDs
- Record chi-squared p-value, flakiness rate, and composite flakiness score per test
- Tests with score >= 70 are auto-quarantine candidates

### Step 3: Smart Retry with Backoff

Before quarantining, attempt smart retry to confirm flakiness. Run each candidate test in isolation with exponential backoff between attempts.

- Retry schedule: attempt 1 (immediate), attempt 2 (500ms delay), attempt 3 (2s delay), attempt 4 (8s delay)
- If all 4 attempts pass: downgrade flakiness score by 30 points, remove from candidate list
- If any attempt fails: confirm as flaky, proceed to quarantine
- `Tool: mcp__mcp-graph__metrics` — record retry outcomes and timing data

### Step 4: Auto-Quarantine

Tag confirmed flaky tests with quarantine metadata. Create a dedicated graph node for tracking the quarantined test.

- `Tool: mcp__mcp-graph__node` — action: `add`, type: `task`, create quarantine tracking node
- Add metadata: `quarantine_date`, `flakiness_score`, `last_failure_error`, `suspected_root_cause`
- Mark the test with `skip` annotation in the test file (add `.skip` or `@quarantine` tag)
- Set a quarantine expiry (default: 7 days) after which the test must be fixed or deleted

### Step 5: Root Cause Diagnosis

Systematically diagnose the root cause using a decision tree of common flaky test patterns.

| Pattern | Indicators | Fix Strategy |
|---------|-----------|--------------|
| Timing/Race Condition | Failures correlate with CI load; passes locally | Replace sleep/timeout with explicit waits or polling |
| Shared State | Failures depend on test execution order | Isolate state per test; use fresh fixtures |
| External Dependency | Failures correlate with network/service availability | Mock external boundaries; use contract tests |
| Resource Leak | Failures increase over suite duration | Add proper teardown; detect unclosed handles |
| Non-deterministic Input | Failures with specific random seeds | Pin seeds or use property-based testing with shrinking |

- `Tool: mcp__mcp-graph__search` — search for related test failures and shared fixtures
- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, check related node dependencies

### Step 6: Apply Deterministic Fix

Replace the flaky test with a deterministic equivalent. The fix must eliminate the source of non-determinism, not mask it with retries.

- Replace wall-clock timeouts with event-driven assertions
- Replace shared mutable state with per-test factories
- Replace external calls with in-process fakes or contract stubs
- Replace random data with deterministic generators (seeded PRNG)
- Run the fixed test 20 times in sequence to confirm stability

### Step 7: Validate Fix and Update Budget

Confirm the fix eliminates flakiness and update the Flakiness Budget metric.

- `Tool: mcp__mcp-graph__analyze` — mode: `validate_ready`, verify the fix node
- `Tool: mcp__mcp-graph__metrics` — update flakiness budget for the affected module
- Flakiness Budget = max allowed flaky tests per module (default: 0 for core, 2 for integration)
- If budget is exceeded after fix, escalate to blocking priority

### Step 8: Persist Knowledge

Record the diagnosis, fix pattern, and outcome for future reference.

- `Tool: mcp__mcp-graph__write_memory` — save flaky test pattern, root cause, and fix strategy
- Include: test ID, flakiness score before/after, root cause category, fix description
- Tag memory with `flaky-test`, `testing-resilience`, and the affected module name

## Output Format

```
## Flaky Test Report

### Summary
- Candidates scanned: {N}
- Confirmed flaky: {N}
- Quarantined: {N}
- Fixed: {N}
- Flakiness Budget status: {module: used/limit, ...}

### Confirmed Flaky Tests
| Test ID | Flakiness Score | Root Cause | Status | Fix Applied |
|---------|----------------|------------|--------|-------------|
| {id}    | {score}/100    | {category} | {quarantined/fixed/pending} | {description} |

### Chi-Squared Results
| Test ID | Chi-sq Value | p-value | Verdict |
|---------|-------------|---------|---------|
| {id}    | {value}     | {p}     | {flaky/stable} |

### Flakiness Budget
| Module | Budget | Used | Remaining | Status |
|--------|--------|------|-----------|--------|
| {name} | {max}  | {n}  | {rem}     | {ok/exceeded} |

### Knowledge Persisted
- Memory ID: {id}
- Patterns recorded: {N}
```

## Anti-Patterns

- Do NOT simply add retries to mask flaky tests -- retries are diagnostic, not a fix
- Do NOT delete flaky tests without understanding the root cause; the flakiness may indicate a real bug
- Do NOT increase timeouts as a fix; replace time-based waits with event-based assertions
- Do NOT allow quarantined tests to remain quarantined indefinitely; enforce expiry deadlines
- Do NOT skip the statistical detection step; gut-feel flakiness assessment leads to false positives
- Do NOT fix flaky tests by making assertions weaker or more permissive
- Do NOT ignore flakiness in integration tests because "they're expected to be flaky" -- all tests must be deterministic
