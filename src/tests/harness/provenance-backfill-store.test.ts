/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * applyProvenanceBackfill — DB integration of the pure backfill function.
 *
 * AC1 — applies inheritable updates and reports {scanned, updated} counters
 * AC2 — re-running on the same DB is a no-op (idempotent)
 * AC3 — only nodes with empty source_file are touched (existing values preserved)
 * AC4 — metadata.provenance.inherited_from is set on each updated node
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../../core/store/migrations.js";
import { applyProvenanceBackfill } from "../../core/harness/provenance-backfill-store.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 'test', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

function insertNode(
  db: Database.Database,
  id: string,
  type: string,
  sourceFile: string | null,
): void {
  db.prepare(`
    INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at, source_file, metadata)
    VALUES (?, 'p', ?, ?, 'backlog', 3, 0, '2026-01-01', '2026-01-01', ?, '{}')
  `).run(id, type, `${type} ${id}`, sourceFile);
}

function insertParentEdge(db: Database.Database, parent: string, child: string): void {
  db.prepare(`
    INSERT INTO edges (id, project_id, from_node, to_node, relation_type, created_at)
    VALUES (?, 'p', ?, ?, 'parent_of', '2026-01-01')
  `).run(`e_${parent}_${child}`, parent, child);
}

describe("applyProvenanceBackfill (DB)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("AC1 — applies inheritable updates and reports counters", () => {
    insertNode(db, "epic1", "epic", "docs/prd/auth.md");
    insertNode(db, "task1", "task", null);
    insertNode(db, "task2", "task", null);
    insertParentEdge(db, "epic1", "task1");
    insertParentEdge(db, "task1", "task2");

    const result = applyProvenanceBackfill(db);

    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(2);

    const t1 = db
      .prepare("SELECT source_file FROM nodes WHERE id = 'task1'")
      .get() as { source_file: string };
    const t2 = db
      .prepare("SELECT source_file FROM nodes WHERE id = 'task2'")
      .get() as { source_file: string };
    expect(t1.source_file).toBe("docs/prd/auth.md");
    expect(t2.source_file).toBe("docs/prd/auth.md");
  });

  it("AC2 — re-running is a no-op", () => {
    insertNode(db, "epic1", "epic", "docs/prd/foo.md");
    insertNode(db, "task1", "task", null);
    insertParentEdge(db, "epic1", "task1");

    applyProvenanceBackfill(db);
    const second = applyProvenanceBackfill(db);

    expect(second.updated).toBe(0);
  });

  it("AC3 — does not overwrite an existing source_file", () => {
    insertNode(db, "epic1", "epic", "docs/prd/foo.md");
    insertNode(db, "task1", "task", "tasks/explicit.md");
    insertParentEdge(db, "epic1", "task1");

    applyProvenanceBackfill(db);

    const row = db
      .prepare("SELECT source_file FROM nodes WHERE id = 'task1'")
      .get() as { source_file: string };
    expect(row.source_file).toBe("tasks/explicit.md");
  });

  it("AC4 — records inherited_from in metadata.provenance", () => {
    insertNode(db, "epic1", "epic", "docs/prd/foo.md");
    insertNode(db, "task1", "task", null);
    insertParentEdge(db, "epic1", "task1");

    applyProvenanceBackfill(db);

    const row = db
      .prepare("SELECT metadata FROM nodes WHERE id = 'task1'")
      .get() as { metadata: string };
    const parsed = JSON.parse(row.metadata) as {
      provenance?: { inherited_from?: string; source?: string };
    };
    expect(parsed.provenance?.inherited_from).toBe("epic1");
  });
});
