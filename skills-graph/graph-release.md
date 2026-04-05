---
name: graph-release
description: Release management using semantic versioning automation, changelog generation, feature flag lifecycle, canary strategy, and stale flag cleanup
triggers:
  - graph-release
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-release

Release management using semantic versioning automation, changelog generation from graph nodes, feature flag lifecycle, canary deployment strategy, and stale flag cleanup. Ensures every release is traceable, reversible, and well-documented.

## When to Use

- During HANDOFF/DEPLOY phases
- When preparing a release
- When managing feature flags
- Monthly release health reviews
- When cleaning up stale feature flags

## Mandatory Flow

```
version strategy → changelog generation → feature flag audit → release checklist → canary plan → rollback plan → report → write_memory
```

## Workflow

### Step 1: Version Strategy

Determine version bump based on changes: BREAKING (removed/renamed public API) -> major, new features -> minor, bug fixes -> patch. Use `git log --oneline <last-tag>..HEAD` to list changes. Cross-reference with graph nodes: `mcp__mcp-graph__list(type:"task", status:"done")`. Verify conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`). Recommend semver bump.

### Step 2: Changelog Generation

Auto-generate changelog from graph nodes and git history. Group by:

| Category | Source |
|----------|--------|
| Features | `feat:` commits + done epics |
| Bug Fixes | `fix:` commits + bug-tagged tasks |
| Breaking Changes | `feat!:` commits |
| Performance | `perf:` commits |
| Documentation | `docs:` commits |

Include task IDs and links. Use `mcp__mcp-graph__export(action:"csv")` for structured data.

### Step 3: Feature Flag Audit

Inventory all feature flags in codebase (grep for flag patterns, environment variables, config toggles). For each flag: creation date, purpose, current state (enabled/disabled), owner. Flag stale flags (>90 days old, always enabled). Recommend: remove stale flags, document active flags, add expiry dates.

### Step 4: Release Checklist

Verify pre-release gates:

| Gate | Command | Required |
|------|---------|----------|
| All tests pass | `npm test` | Yes |
| Build succeeds | `npm run build` | Yes |
| Lint clean | `npm run lint` | Yes |
| Typecheck clean | `npm run typecheck` | Yes |
| CHANGELOG updated | Manual check | Yes |
| Version bumped | `package.json` check | Yes |
| No in_progress tasks | `mcp__mcp-graph__analyze(mode:"release_check")` | Yes |
| Deploy readiness | `mcp__mcp-graph__analyze(mode:"deploy_ready")` | Yes |

### Step 5: Canary Strategy

Define gradual rollout plan if applicable: percentage-based rollout (1% -> 10% -> 50% -> 100%), metrics to monitor during rollout (error rate, latency, user complaints), rollback triggers (error rate >5%, latency >2x baseline), rollout timeline (hours between stages).

### Step 6: Rollback Plan

Document rollback procedure: revert commit hash, database migration rollback (if applicable), feature flag kill switch, communication template for stakeholders. Verify rollback is tested: `git revert --no-commit HEAD` dry run. Ensure previous version is deployable.

### Step 7: Release Report

Version number, changelog summary, feature flags status, release checklist pass/fail, canary plan, rollback plan documented. Save via `mcp__mcp-graph__write_memory`. Create snapshot: `mcp__mcp-graph__snapshot(action:"create")`.

## Output Format

```
Phase: RELEASE MANAGEMENT
Version: major.minor.patch (bump type: major|minor|patch)
Changelog: N features, N fixes, N breaking changes
Feature Flags: N active, N stale (>90d), N removed
Release Checklist: N/N gates passed
Canary Plan: rollout stages defined (1% → 10% → 50% → 100%)
Rollback Plan: documented (revert hash, flag kill switch, comms template)
Overall Release Readiness: Grade A-F

Saved to memory: "Release vX.Y.Z — <date>"
Snapshot created: "pre-release-vX.Y.Z"
```

## Anti-Patterns

- Do NOT release without running full test suite
- Do NOT skip changelog — it's the user-facing documentation of changes
- Do NOT leave stale feature flags — they add complexity and confusion
- Do NOT skip rollback plan — every release needs an exit strategy
- Do NOT canary without monitoring — blind rollouts are not canary
- Do NOT bump version manually — use conventional commits + release-please
- Do NOT release on Fridays — incidents need weekday response capacity
