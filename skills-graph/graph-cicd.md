---
name: graph-cicd
description: CI/CD pipeline optimization using build profiling, flaky test quarantine, caching strategies, and GitHub Actions workflow analysis
triggers:
  - graph-cicd
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-cicd

CI/CD pipeline optimization using build profiling, flaky test quarantine, caching strategies, and GitHub Actions workflow analysis. Identifies bottlenecks, eliminates waste, and hardens pipeline security.

## When to Use

- When CI builds are slow (>10min)
- When flaky tests block merges
- During DEPLOY phase optimization
- When setting up new pipelines
- Monthly CI health review

## Mandatory Flow

```
pipeline inventory → build profiling → flaky test detection → cache analysis → workflow optimization → security scan → report → write_memory
```

## Workflow

### Step 1: Pipeline Inventory

Catalog all CI/CD workflows:

```bash
ls -la .github/workflows/
```

For each workflow, map:
- **Trigger events** — push, pull_request, schedule, workflow_dispatch
- **Job dependencies** — `needs:` chains between jobs
- **Matrix strategies** — OS, Node version, test shard combinations
- **Artifact flows** — uploads/downloads between jobs
- **Critical path** — longest job chain (determines total build time)

Use recent run data for baseline:
```bash
gh run list --limit 10
```

### Step 2: Build Time Profiling

Analyze build times per job and step. Identify bottlenecks:

| Step | Typical Duration | Optimization |
|------|-----------------|--------------|
| `npm install` | 30-120s | Cache `node_modules` via `actions/cache` |
| `tsc` compilation | 15-60s | Incremental builds, `--incremental` flag |
| Test execution | 60-300s | Parallel shards, `--shard` flag |
| Dashboard build | 30-120s | Pre-built artifacts, conditional build |
| Linting | 10-30s | Cache ESLint results, `--cache` flag |

Compare with DORA deployment frequency target. Flag any step exceeding 2 minutes.

```bash
gh run view <run-id> --log | grep "##\[group\]"
```

### Step 3: Flaky Test Detection

Analyze test failures across recent CI runs:

```bash
gh run list --status failure --limit 20
```

Identify flaky tests — tests that fail intermittently (pass on retry without code changes).

Quarantine strategy:
1. **Identify** — find tests that fail >10% of runs but pass on retry
2. **Isolate** — move flaky tests to a separate test suite (`*.flaky.test.ts`)
3. **Fix root cause** — timing issues, external dependencies, shared state, race conditions
4. **Promote back** — once stable for 10+ consecutive runs, move back to main suite

Track flaky test ratio: `flaky_count / total_test_count`. Target: < 1%.

### Step 4: Cache Optimization

Audit caching strategy for all cacheable artifacts:

| Artifact | Cache Key | Restore Key | Expected Hit Rate |
|----------|-----------|-------------|-------------------|
| `node_modules` | `npm-${{ hashFiles('package-lock.json') }}` | `npm-` | > 90% |
| Build output (`dist/`) | `build-${{ hashFiles('src/**') }}` | `build-` | > 70% |
| ESLint cache | `eslint-${{ hashFiles('.eslintrc*') }}` | `eslint-` | > 95% |
| Dashboard deps | `dashboard-${{ hashFiles('src/web/**/package-lock.json') }}` | `dashboard-` | > 90% |

Verify:
- Cache keys include lock file or source hash
- Restore keys provide fallback for partial matches
- No stale caches persisting beyond useful lifetime
- Cache size within GitHub Actions limits (10 GB per repo)

### Step 5: Workflow Optimization

Recommend improvements based on profiling data:

- **Parallel job execution** — independent jobs should not use `needs:`
- **Conditional steps** — use `paths:` filters to skip irrelevant jobs on PRs
- **Matrix strategy** — test across OS/versions only where necessary
- **Reusable workflows** — extract common patterns into `.github/workflows/reusable-*.yml`
- **Composite actions** — bundle repeated step sequences into custom actions
- **Fail-fast** — use `fail-fast: true` in matrix to abort on first failure
- **Timeouts** — set `timeout-minutes` per job to prevent runaway builds

Calculate potential time savings for each recommendation.

Check for redundant steps:
- Duplicate installs across jobs (use artifacts instead)
- Running full test suite on docs-only changes
- Building dashboard when only backend changed

### Step 6: Pipeline Security

Verify CI/CD security posture:

| Check | What to Verify | Severity |
|-------|----------------|----------|
| Secrets exposure | No secrets printed in logs (`echo $SECRET`) | Critical |
| Token permissions | `GITHUB_TOKEN` uses minimal `permissions:` block | High |
| Action pinning | Third-party actions pinned to SHA, not tags | High |
| Self-hosted runners | No self-hosted runners exposed to untrusted PRs | Critical |
| Artifact retention | Artifacts have reasonable retention (< 90 days) | Medium |
| Environment protection | Production deploys require approval | High |
| Dependency review | `actions/dependency-review-action` on PRs | Medium |

Cross-reference with `/graph-security` findings for comprehensive coverage.

### Step 7: CI/CD Report

Generate comprehensive report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "CI/CD Health Report — <date>"
  content: "<report with metrics, findings, recommendations>"
  tags: ["cicd", "pipeline", "optimization", "report"]
```

Score the pipeline 0-100:

| Category | Weight | Scoring |
|----------|--------|---------|
| Build time | 25% | 100 if < 5min, 75 if < 10min, 50 if < 15min, 25 if < 20min, 0 if > 20min |
| Flaky test ratio | 20% | 100 if < 1%, 75 if < 3%, 50 if < 5%, 0 if > 5% |
| Cache hit rate | 20% | 100 if > 90%, 75 if > 70%, 50 if > 50%, 0 if < 50% |
| Security compliance | 20% | 100 if all checks pass, deduct per finding |
| Optimization coverage | 15% | Based on recommendations implemented |

## Output Format

```
Phase: CI/CD HEALTH CHECK
Avg Build Time: <duration> (target: < 10min)
Flaky Tests: N tests (N% of suite)
Cache Hit Rate: N% (target: > 90%)
Critical Path: <job chain> — <duration>
Optimizations: N recommendations (est. savings: <time>)
Security Issues: N critical, N high, N medium
Overall Grade: <score>/100 (<A/B/C/D/F>)

Saved to memory: "CI/CD Health Report — <date>"
```

## Anti-Patterns

- Do NOT ignore flaky tests — they erode trust in CI
- Do NOT cache without lock file hash — stale deps cause mysterious failures
- Do NOT use `latest` tag for actions — pin to SHA for security
- Do NOT run all tests on every PR — use path filters
- Do NOT skip CI security audit — CI has elevated permissions
- Do NOT optimize before measuring — profile first
