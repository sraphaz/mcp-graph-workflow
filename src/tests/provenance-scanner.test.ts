/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Direct unit tests for scanProvenance — the existing provenance-dimension
 * suite drives it through the harness pipeline; this suite exercises the
 * function in isolation, locking the boundary contract (empty DB, partial
 * receipts, edge cases).
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { scanProvenance } from "../core/harness/provenance-scanner.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 't', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

function insertNode(db: Database.Database, id: string, sourceFile: string | null): void {
  db.prepare(`
    INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at, source_file)
    VALUES (?, 'p', 'task', ?, 'backlog', 3, 0, '2026-01-01', '2026-01-01', ?)
  `).run(id, `Task ${id}`, sourceFile);
}

describe("scanProvenance", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("empty graph → score 100, no penalty for nothing-to-trace", () => {
    const result = scanProvenance(db);
    expect(result).toEqual({ provenanceScore: 100, totalNodes: 0, nodesWithReceipt: 0 });
  });

  it("all nodes lack source_file → score 0", () => {
    insertNode(db, "n1", null);
    insertNode(db, "n2", null);
    const result = scanProvenance(db);
    expect(result.provenanceScore).toBe(0);
    expect(result.totalNodes).toBe(2);
    expect(result.nodesWithReceipt).toBe(0);
  });

  it("all nodes have source_file → score 100", () => {
    insertNode(db, "n1", "docs/prd/a.md");
    insertNode(db, "n2", "docs/prd/b.md");
    const result = scanProvenance(db);
    expect(result.provenanceScore).toBe(100);
    expect(result.nodesWithReceipt).toBe(2);
  });

  it("half-and-half → score 50", () => {
    insertNode(db, "n1", "x.md");
    insertNode(db, "n2", null);
    expect(scanProvenance(db).provenanceScore).toBe(50);
  });

  it("empty string source_file does not count as receipt", () => {
    insertNode(db, "n1", "");
    insertNode(db, "n2", "real.md");
    const result = scanProvenance(db);
    expect(result.nodesWithReceipt).toBe(1);
    expect(result.provenanceScore).toBe(50);
  });

  it("score is rounded (not floored)", () => {
    insertNode(db, "n1", "a.md");
    insertNode(db, "n2", "b.md");
    insertNode(db, "n3", null); // 2/3 = 66.67
    expect(scanProvenance(db).provenanceScore).toBe(67);
  });

  it("returns the documented shape", () => {
    insertNode(db, "n1", "a.md");
    const result = scanProvenance(db);
    expect(result).toHaveProperty("provenanceScore");
    expect(result).toHaveProperty("totalNodes");
    expect(result).toHaveProperty("nodesWithReceipt");
  });
});
