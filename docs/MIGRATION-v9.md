# Migration Guide: v8.x to v9.x

## Overview

v9.0 introduces the **Multi-Terminal Orchestrator** (teamTask mode) — a cooperative task claim protocol that enables multiple Claude Code terminals to work on the same graph without conflicts.

**Zero breaking changes.** All v8.x behavior is preserved when teamTask mode is off (default).

## New Features

### Multi-Terminal Orchestrator (v9.0+)

| Feature | Description |
|---------|-------------|
| **Task Claim Protocol** | `start_task` acquires exclusive lock via `LockManager`. Returns `leaseToken`. Other agents get `LockConflictError`. |
| **Ownership Verification** | `finish_task` verifies the calling agent owns the lock before marking done. |
| **Lock-Aware Next** | `next` and `findEnhancedNextTask` exclude tasks locked by other agents. |
| **Cross-Terminal Events** | `SqliteEventBridge` publishes events to `event_queue` table, polls for events from other agents every 2s. |
| **Orphan Task Reconciliation** | `detectOrphanTasks` finds backlog/ready tasks whose source files already exist on disk. |
| **Agent Heartbeat** | `AgentHeartbeat` renews locks every 30s and publishes `agent:heartbeat` events. |

### Activation

```
set_phase({ teamTask: true })
```

This persists `team_task_mode = 'on'` in project settings. When off (default), all behavior is identical to v8.x.

### New MCP Tool Parameters

| Tool | New Parameters |
|------|---------------|
| `start_task` | `agentId` (optional) — enables lock-based claiming, returns `leaseToken` |
| `finish_task` | `agentId`, `leaseToken` (optional) — verifies ownership, releases lock |
| `next` | `agentId` (optional) — excludes tasks locked by other agents |
| `set_phase` | `teamTask` (boolean, optional) — enables/disables teamTask mode |
| `analyze` | New mode: `orphan_tasks` — detects implemented but untracked tasks |
| `list` | Shows `lockedBy` and `lockExpiresAt` when teamTask mode is on |
| `show` | Shows `lock` object with `agentId`, `expiresAt`, `ttlRemainingMs` |

### New Event Types

- `task:claimed` — emitted when an agent claims a task
- `task:released` — emitted when a task lock is released
- `agent:heartbeat` — periodic agent presence signal

### Database Migration

**Migration v38** (auto-applied on first run):

```sql
CREATE TABLE event_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload    TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### New Files

| File | Purpose |
|------|---------|
| `src/core/store/lock-manager.ts` | Lease-based resource locking with TTL |
| `src/core/events/sqlite-event-bridge.ts` | Cross-terminal event propagation |
| `src/core/analyzer/orphan-task-detector.ts` | Orphan task detection |
| `src/core/agents/agent-heartbeat.ts` | Periodic lock renewal + heartbeat |

## Upgrade Steps

1. `npm install -g @mcp-graph-workflow/mcp-graph@latest`
2. Migration v38 runs automatically on first use
3. Optionally enable teamTask mode: `set_phase({ teamTask: true })`
