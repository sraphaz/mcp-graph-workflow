---
name: graph-migration
description: Database migration safety audit using schema versioning, rollback planning, backward compatibility checks, data integrity verification, and migration drift detection
triggers:
  - graph-migration
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-migration

Database migration safety audit using schema versioning, rollback planning, backward compatibility checks, data integrity verification, and migration drift detection. Ensures schema changes are safe, backward-compatible, and recoverable across all SQLite migrations.

## When to Use

- Before adding new migrations to the codebase
- During REVIEW phase for schema changes
- When upgrading major versions
- When migration count exceeds 25+ (complexity threshold)
- During quarterly maintenance reviews

## Mandatory Flow

```
migration inventory --> schema analysis --> backward compatibility --> rollback plan --> data integrity --> drift detection --> report --> write_memory
```

## Workflow

### Step 1: Migration Inventory

Catalog all migrations in `src/core/store/migrations.ts`. For each migration, list:
- Version number
- Description
- Tables affected
- Indexes created

Verify sequential numbering (no gaps, no duplicates). Check current version count. Use grep to count migration entries. Flag if version count >30 (complexity threshold).

### Step 2: Schema Analysis

For each table, document:
- Columns, types, constraints (NOT NULL, UNIQUE, FOREIGN KEY)
- Indexes (regular and FTS5)

Verify naming conventions: `snake_case` tables, `snake_case` columns. Check for missing indexes on foreign keys. Verify all FTS5 virtual tables have corresponding source tables. Use `PRAGMA table_info(<table>)` pattern.

### Step 3: Backward Compatibility Check

For each recent migration, verify:

| Check | What to Verify |
|-------|---------------|
| No column removals | Columns not removed without deprecation |
| No type changes | Existing column types not altered |
| Default values | New columns have DEFAULT values |
| No table renames | Tables not renamed without migration path |
| Idempotency | IF NOT EXISTS used for all CREATE TABLE/INDEX |

Flag breaking changes that would fail on existing databases.

### Step 4: Rollback Planning

For each migration, document rollback procedure:
- What to DROP
- What to ALTER
- Data recovery strategy

Verify SQLite limitations: no DROP COLUMN before 3.35.0, no ALTER COLUMN type. For destructive migrations, require backup step. Create rollback SQL templates.

### Step 5: Data Integrity Verification

Run integrity checks on database:
- `PRAGMA integrity_check`
- `PRAGMA foreign_key_check`

Verify:
- No orphaned rows (foreign keys satisfied)
- No duplicate unique values
- FTS5 indexes in sync with source tables

Use `mcp__mcp-graph__analyze(mode:"data_integrity")` for graph-specific checks.

### Step 6: Migration Drift Detection

Compare expected schema (from `migrations.ts`) with actual database schema (`PRAGMA table_info`). Detect:

- Tables in DB not in migrations (manual additions)
- Columns in migrations not in DB (failed migrations)
- Index mismatches

Flag any drift as potential data corruption risk.

### Step 7: Migration Report

Compile the full audit report:

```
Total migrations: <N>
Schema complexity: <N> tables, <N> columns, <N> indexes
Backward compatibility score: <N>%
Rollback coverage: <N>%
Integrity check: PASS/FAIL
Drift items: <N>
Overall health grade: <A-F>
```

Save findings:
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Migration Audit — <date>"
  content: "<findings summary with migration count, compatibility score, drift items>"
  tags: ["migration", "audit", "schema", "integrity"]
```

## Output Format

```
Phase: MIGRATION AUDIT
Migration count: <N>
Schema: <N> tables, <N> columns, <N> indexes
Backward compat score: <N>%
Rollback coverage: <N>%
Integrity check: PASS/FAIL
Drift items: <N>
Overall health grade: <A-F>

Saved to memory: "Migration Audit — <date>"
```

## Anti-Patterns

- Do NOT add migrations without IF NOT EXISTS — idempotency is critical
- Do NOT remove columns without a deprecation migration first
- Do NOT skip PRAGMA integrity_check — silent corruption grows
- Do NOT add columns without DEFAULT values — breaks existing rows
- Do NOT manually modify the database — all changes through migrations
- Do NOT skip rollback planning — failed migrations need recovery
- Do NOT ignore migration drift — it indicates manual DB edits
