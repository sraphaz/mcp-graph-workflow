---
name: graph-nirvana-resilience-ops
description: Autonomous operational resilience — SQLite backup/recovery, resource optimization with Little's Law, and smart deployment with rollback
triggers:
  - graph-nirvana-resilience-ops
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nirvana-resilience-ops

Autonomous operational resilience engine that manages backups, optimizes resources, and automates deployment with smart rollback. Combines three capabilities: **backup/recovery** (SQLite protection), **resource optimization** (CPU/memory/query tuning via Little's Law), and **deployment automation** (deploy + rollback).

Unlike manual `graph-deploy`, this skill is **proactive** — it continuously monitors system health, auto-backs up before risky operations, and rolls back automatically on failure.

Integrates into the MAPE-K loop: **Monitor** (health check) → **Analyze** (resource profiling) → **Plan** (optimization + deploy plan) → **Execute** (backup + deploy) → **Knowledge** (save ops trends).

## When to Use

- Before any risky operation (schema migration, major refactor, deploy)
- When system performance degrades (slow queries, high memory)
- During DEPLOY phase for automated release pipeline
- Periodically (daily recommended) for backup rotation
- After system failure for recovery
- The user says "backup", "optimize resources", "deploy", "rollback", or "nirvana ops"

## Mandatory Flow

```
health_check → auto_backup → resource_profiling → littles_law → query_optimization → deploy_readiness → deploy_execution → smart_rollback → ops_report → write_memory
```

## Workflow

### Step 1: Health Check

Verify system integrity before any operation:

```bash
# SQLite integrity check
sqlite3 workflow-graph/graph.db "PRAGMA integrity_check;"

# Disk space
df -h . | tail -1

# Database size
du -sh workflow-graph/graph.db 2>/dev/null || echo "No database found"

# WAL file check (uncommitted transactions)
ls -la workflow-graph/graph.db-wal 2>/dev/null || echo "No WAL file"
```

| Check | Expected | Severity if Failed |
|-------|----------|-------------------|
| Integrity check | "ok" | **critical** — stop all operations |
| Disk space | >500MB free | **high** — backup + cleanup |
| WAL file size | <50MB | **medium** — checkpoint needed |
| DB file locked | No SQLITE_BUSY | **high** — identify locking process |

If integrity check fails: trigger immediate recovery from latest backup.

### Step 2: Auto-Backup

Create incremental backup with rotation:

```bash
# Create backup directory
mkdir -p workflow-graph/backups

# Timestamp-based backup
BACKUP_NAME="graph-$(date +%Y%m%d-%H%M%S).db"
sqlite3 workflow-graph/graph.db ".backup 'workflow-graph/backups/${BACKUP_NAME}'"

# Verify backup integrity
sqlite3 "workflow-graph/backups/${BACKUP_NAME}" "PRAGMA integrity_check;"

# Rotate: keep last 7 backups
ls -t workflow-graph/backups/graph-*.db | tail -n +8 | xargs rm -f 2>/dev/null
```

| Policy | Value | Rationale |
|--------|-------|-----------|
| Backup frequency | Before every deploy + daily | Protect against data loss |
| Retention | Last 7 backups | Balance storage vs. recovery options |
| Verification | Integrity check on each backup | Ensure backups are usable |
| Location | `workflow-graph/backups/` | Local, gitignored |

### Step 3: Resource Profiling

Measure system resource usage:

```bash
# SQLite page count and size
sqlite3 workflow-graph/graph.db "PRAGMA page_count; PRAGMA page_size;"

# Table sizes
sqlite3 workflow-graph/graph.db "SELECT name, SUM(pgsize) as size FROM dbstat GROUP BY name ORDER BY size DESC LIMIT 10;" 2>/dev/null || echo "dbstat not available"

# Index usage stats
sqlite3 workflow-graph/graph.db "PRAGMA index_list('nodes');"
```

Memory baseline:
```bash
# Node.js memory snapshot
node -e "console.log(JSON.stringify(process.memoryUsage(), null, 2))"
```

### Step 4: Little's Law Analysis

Apply Little's Law to the execution graph for flow optimization:

```
Tool: mcp__mcp-graph__metrics
```

Calculate:
- **WIP** = count of tasks with status `in_progress`
- **Throughput** = tasks completed per day (rolling 7-day)
- **Cycle Time** = WIP / Throughput (Little's Law)

| Metric | Target | Action if Exceeded |
|--------|--------|--------------------|
| WIP | ≤1 per agent | Reduce: finish before starting |
| Cycle time | ≤8h for M tasks | Investigate: blocked deps? scope creep? |
| Throughput | ≥2 tasks/day | Optimize: reduce WIP, remove bottlenecks |
| Flow efficiency | >40% active time | Investigate wait time sources |

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

Cross-reference with DORA metrics for delivery health.

### Step 5: Query Optimization

Identify and optimize slow SQLite queries:

```bash
# Analyze query plans for common operations
sqlite3 workflow-graph/graph.db "EXPLAIN QUERY PLAN SELECT * FROM nodes WHERE status = 'in_progress';"
sqlite3 workflow-graph/graph.db "EXPLAIN QUERY PLAN SELECT * FROM edges WHERE source_id = 'test';"
sqlite3 workflow-graph/graph.db "EXPLAIN QUERY PLAN SELECT * FROM knowledge WHERE type = 'memory';"
```

| Optimization | Detection | Fix |
|-------------|-----------|-----|
| Missing index | SCAN TABLE in EXPLAIN | CREATE INDEX |
| Unused index | Index not in any EXPLAIN | DROP INDEX (verify first) |
| Large table scan | Full scan on >1000 rows | Add WHERE clause or index |
| WAL bloat | WAL >50MB | PRAGMA wal_checkpoint(TRUNCATE) |
| Fragmentation | Page utilization <80% | VACUUM |

### Step 6: Deploy Readiness Check

Pre-deploy verification checklist:

```bash
npm run build
npm run typecheck
npm test
npm run lint
```

| Gate | Check | Severity |
|------|-------|----------|
| Build | `npm run build` exits 0 | **required** |
| Types | `npm run typecheck` exits 0 | **required** |
| Tests | `npm test` exits 0, 0 failures | **required** |
| Lint | `npm run lint` exits 0 | **required** |
| Backup | Fresh backup created (Step 2) | **required** |
| Version | package.json version bumped | recommended |
| Changelog | CHANGELOG.md updated | recommended |

If any required gate fails: **stop deploy, create fix task**.

### Step 7: Deploy Execution

Automated deployment with progress tracking:

**Local (default):**
```bash
npm run build
# Verify build output
ls -la dist/ | head -10
# Smoke test
node dist/cli/index.js --help
```

**npm publish (if releasing):**
```bash
npm pack --dry-run
# Review package contents before publishing
```

Track deploy in graph:
```
Tool: mcp__mcp-graph__snapshot
```

### Step 8: Smart Rollback

On failure detection, execute automatic recovery:

| Failure Type | Detection | Recovery |
|-------------|-----------|----------|
| Build failure | Non-zero exit code | Fix source, rebuild |
| Test failure post-deploy | Test suite fails on deployed code | Restore backup, revert commit |
| Runtime crash | Process exits unexpectedly | Restore backup, create incident node |
| Data corruption | Integrity check fails | Restore from latest verified backup |

Recovery procedure:
```bash
# 1. Identify latest verified backup
LATEST_BACKUP=$(ls -t workflow-graph/backups/graph-*.db | head -1)

# 2. Verify backup integrity
sqlite3 "${LATEST_BACKUP}" "PRAGMA integrity_check;"

# 3. Restore (only if integrity passes)
cp "${LATEST_BACKUP}" workflow-graph/graph.db
```

Create incident node:
```
Tool: mcp__mcp-graph__node
Params:
  action: add
  type: task
  name: "[Incident] Deploy failure — <reason>"
  description: "<failure details, backup used, recovery steps taken>"
  priority: critical
  metadata: { "source": "nirvana-resilience-ops", "category": "incident" }
```

### Step 9: Ops Report & Memory

Generate operational report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Nirvana Resilience Ops — <date>"
  content: "<health status, backup stats, resource metrics, Little's Law analysis, deploy status, optimizations applied>"
  tags: ["nirvana", "resilience", "ops", "backup", "deploy", "performance"]
```

## Output Format

```
Phase: NIRVANA RESILIENCE OPS (MAPE-K)
Health: integrity ok/FAIL, disk N GB free, WAL N MB
Backup: created graph-<timestamp>.db (N backups retained)
Resources:
  DB Size: N MB (N tables, N indexes)
  Memory: RSS N MB, Heap N MB
  Little's Law: WIP=N, Throughput=N/day, Cycle Time=Nh
Query Optimizations: N applied (N missing indexes, N vacuums)
Deploy: success/skipped/FAILED
  Build: pass/fail
  Tests: pass/fail (N passed, N failed)
  Smoke: pass/fail
Rollback: not needed / triggered (backup: <name>)

Overall Status: HEALTHY / DEGRADED / CRITICAL
Saved to memory: "Nirvana Resilience Ops — <date>"
```

## Anti-Patterns

- Do NOT deploy without a fresh backup — always backup BEFORE any risky operation
- Do NOT ignore integrity check failures — a corrupted DB will corrupt backups too
- Do NOT keep unlimited backups — rotation prevents disk exhaustion
- Do NOT optimize queries without EXPLAIN — guessing causes more harm than good
- Do NOT auto-apply VACUUM on large databases during active use — it locks the DB
- Do NOT skip the smoke test — a successful build ≠ a working application
- Do NOT rollback without verifying the backup first — restoring a corrupt backup is worse
- Do NOT ignore Little's Law metrics — high WIP is the #1 cause of slow delivery
