---
name: graph-schema-evolution-manager
description: Schema migration management with backward compatibility validation, version tracking, and safe rollback within the graph
triggers:
  - graph-schema-evolution-manager
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-schema-evolution-manager

Manages schema evolution across the execution graph, ensuring backward compatibility for all persisted data (SQLite rows, JSON files, API contracts, Zod schemas). Tracks schema versions as graph nodes, validates migrations with shadow testing, and provides safe rollback paths when breaking changes are unavoidable.

## When to Use

- Before modifying any Zod schema in `src/schemas/` that validates persisted data
- When adding, removing, or renaming fields in SQLite tables or knowledge store entries
- During DESIGN phase to plan schema migrations for upcoming features
- When API contract changes affect MCP tool inputs/outputs or REST endpoints
- After discovering data that fails validation against the current schema
- Before DEPLOY to verify all schema changes are backward compatible

## Mandatory Flow

```
inventory current schemas → detect changes → classify compatibility → generate migration plan → create migration nodes → implement with shadow test → validate both formats → deploy migration → write_memory
```

## Workflow

### Step 1: Inventory Current Schemas

Catalog all schemas that govern persisted data:

```
Tool: mcp__mcp-graph__search (query: "schema OR migration OR zod OR validate OR type definition")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Schema categories:
| Category | Location | Persistence |
|----------|----------|-------------|
| Graph schemas | `src/schemas/` | SQLite graph.db |
| Knowledge schemas | `src/core/store/` | SQLite knowledge tables |
| API contracts | `src/api/routes/` | REST request/response |
| MCP tool schemas | `src/mcp/tools/` | MCP tool inputs/outputs |
| Config schemas | `src/core/config/` | JSON config files |

### Step 2: Detect Schema Changes

Compare proposed changes against the current schema version:

```
Tool: mcp__mcp-graph__search (query: "breaking change OR field rename OR field remove OR type change")
```

Change types to detect:
- **Field addition:** New field with default value (safe)
- **Field removal:** Existing field deleted (breaking)
- **Field rename:** Field name changed (breaking)
- **Type change:** Field type modified (potentially breaking)
- **Constraint change:** Validation rules modified (potentially breaking)
- **Enum extension:** New values added to enum (safe if consumers handle unknown)
- **Enum reduction:** Values removed from enum (breaking)

### Step 3: Classify Compatibility

Rate each change on the compatibility spectrum:

| Level | Description | Action Required |
|-------|-------------|----------------|
| **Safe** | Additive only (new optional fields, new enum values) | Deploy directly |
| **Compatible** | Additive with defaults (new required fields with defaults) | Deploy with migration |
| **Breaking** | Removes or renames fields, changes types | Dual-format support + migration |
| **Critical** | Changes primary keys, removes tables, alters indexes | Staged rollout with rollback plan |

### Step 4: Generate Migration Plan

Create a migration plan based on the compatibility classification:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Schema Migration Plan — <schema-name> v<N>→v<N+1>", type: "task", priority: "high")
```

For each breaking change, define:
- **Up migration:** Transform old format to new format
- **Down migration:** Transform new format back to old format (rollback)
- **Dual-read period:** Duration where both old and new formats are accepted
- **Deprecation timeline:** When old format support will be removed

### Step 5: Create Migration Nodes

Model the migration as graph tasks with dependencies:

```
Tool: mcp__mcp-graph__node (action: "add", name: "Add dual-format reader for <field>", type: "task", priority: "high")
Tool: mcp__mcp-graph__node (action: "add", name: "Migrate existing data — <table>", type: "task", priority: "high")
Tool: mcp__mcp-graph__node (action: "add", name: "Shadow test old vs new format", type: "task", priority: "high")
Tool: mcp__mcp-graph__node (action: "add", name: "Remove old format support", type: "task", priority: "medium")
```

Wire dependencies to enforce order:

```
Tool: mcp__mcp-graph__edge (from: "<dual-reader-id>", to: "<migrate-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<migrate-id>", to: "<shadow-test-id>", type: "depends_on")
Tool: mcp__mcp-graph__edge (from: "<shadow-test-id>", to: "<remove-old-id>", type: "depends_on")
```

### Step 6: Implement with Shadow Testing

Implement the migration using TDD with shadow testing to verify both formats:

```
Tool: mcp__mcp-graph__next ()
Tool: mcp__mcp-graph__update_status (nodeId: "<migration-task-id>", status: "in_progress")
```

Shadow test strategy:
1. Write new schema alongside old schema (both active)
2. Parse existing data through both schemas
3. Compare outputs — they must produce identical results for existing data
4. New data must pass new schema and be readable by old schema (during dual-read period)
5. Log any divergences as test failures

### Step 7: Validate Both Formats

Run comprehensive validation across all persisted data:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
Tool: mcp__mcp-graph__search (query: "validation error OR parse error OR schema mismatch")
```

Validation checklist:
- All existing SQLite rows parse successfully with new schema
- All existing JSON files parse successfully with new schema
- API endpoints accept both old and new format requests
- MCP tools handle both old and new input formats
- No data loss during migration (record counts match before and after)

### Step 8: Deploy and Persist

After validation passes, deploy the migration and record the schema version:

```
Tool: mcp__mcp-graph__node (action: "update", id: "<schema-node-id>", metadata: { version: "<N+1>", migrated_at: "<timestamp>", compatibility: "<level>" })
Tool: mcp__mcp-graph__write_memory (title: "Schema Migration — <schema-name> v<N>→v<N+1> — <date>", content: <migration-report>)
```

## Output Format

```
Phase: SCHEMA EVOLUTION
Schema: <schema-name>
Version: v<old> → v<new>
Changes: <N> total (Safe: <N>, Compatible: <N>, Breaking: <N>, Critical: <N>)
Fields Modified:
  - <field>: <change-type> (<old-type> → <new-type>)
  - <field>: <change-type> (added with default: <value>)
Migration Tasks: <N> nodes created, <N> edges wired
Shadow Test: <N> records tested, <N> divergences
Data Validation: <N> rows migrated, <N> failures
Backward Compatible: YES | NO (dual-read until <date>)
Rollback Plan: <description>
Status: COMPLETE | IN_PROGRESS | BLOCKED

Saved to memory: "Schema Migration — <schema-name> v<N>→v<N+1> — <date>"
```

## Anti-Patterns

- Do NOT modify schemas without checking existing persisted data first — silent data corruption is the worst outcome
- Do NOT skip shadow testing for breaking changes — "it looks right" is not validation
- Do NOT remove old format support before all data is migrated — dual-read period is mandatory
- Do NOT deploy migrations without a rollback plan — every up migration needs a corresponding down migration
- Do NOT change multiple schemas simultaneously — migrate one schema at a time to isolate failures
- Do NOT ignore API contract changes — schema evolution includes REST and MCP tool interfaces, not just database schemas
- Do NOT treat enum extension as always safe — consumers that exhaustively match enum values will break on unknown values
