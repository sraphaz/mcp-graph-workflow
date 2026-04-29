/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A1 — Migration v76: retry_queue table.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 76 — retry_queue table (E22.A1)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates retry_queue table with required columns", () => {
    const cols = db
      .prepare("PRAGMA table_info(retry_queue)")
      .all() as Array<{ name: string; type: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const col of [
      "id",
      "task_id",
      "attempt",
      "next_retry_ms",
      "last_error",
      "status",
      "created_at",
      "updated_at",
    ]) {
      expect(names.has(col), `missing retry_queue.${col}`).toBe(true);
    }
  });

  it("creates indexes on status, next_retry_ms, task_id", () => {
    const indexes = db
      .prepare("PRAGMA index_list(retry_queue)")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("retry_queue") && n.includes("status"))).toBe(true);
    expect(names.some((n) => n.includes("retry_queue") && n.includes("next_retry"))).toBe(true);
    expect(names.some((n) => n.includes("retry_queue") && n.includes("task"))).toBe(true);
  });

  it("registers v76 in _migrations", () => {
    const m = db
      .prepare("SELECT version, description FROM _migrations WHERE version = 76")
      .get() as { version: number; description: string } | undefined;
    expect(m).toBeDefined();
    expect(m?.version).toBe(76);
    expect(m?.description.toLowerCase()).toMatch(/epic 22|retry/);
  });

  it("accepts INSERT into retry_queue with FK to nodes", () => {
    // Need a project + node first
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
    ).run();
    const now = "2026-04-29T00:00:00Z";
    db.prepare(
      `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
       VALUES ('node-1', 'p1', 'subtask', 'Test', 'in_progress', 3, ?, ?)`,
    ).run(now, now);

    expect(() => {
      db.prepare(
        `INSERT INTO retry_queue (id, task_id, attempt, next_retry_ms, last_error, status, created_at, updated_at)
         VALUES ('r1', 'node-1', 0, 1735689600000, NULL, 'pending', ?, ?)`,
      ).run(now, now);
    }).not.toThrow();

    const row = db
      .prepare("SELECT * FROM retry_queue WHERE id = 'r1'")
      .get() as { task_id: string; status: string; attempt: number };
    expect(row.task_id).toBe("node-1");
    expect(row.status).toBe("pending");
    expect(row.attempt).toBe(0);
  });

  it("FK CASCADE: deleting node removes its retry_queue rows", () => {
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
    ).run();
    const now = "2026-04-29T00:00:00Z";
    db.prepare(
      `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
       VALUES ('node-1', 'p1', 'subtask', 'Test', 'in_progress', 3, ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO retry_queue (id, task_id, attempt, next_retry_ms, status, created_at, updated_at)
       VALUES ('r1', 'node-1', 0, 0, 'pending', ?, ?)`,
    ).run(now, now);

    db.prepare("DELETE FROM nodes WHERE id = 'node-1'").run();
    const row = db.prepare("SELECT * FROM retry_queue WHERE id = 'r1'").get();
    expect(row).toBeUndefined();
  });

  it("status accepts pending, done, abandoned values (no CHECK constraint required, app-level)", () => {
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
    ).run();
    const now = "2026-04-29T00:00:00Z";
    db.prepare(
      `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
       VALUES ('n', 'p1', 'subtask', 'T', 'in_progress', 3, ?, ?)`,
    ).run(now, now);

    for (const s of ["pending", "done", "abandoned"]) {
      db.prepare(
        `INSERT INTO retry_queue (id, task_id, attempt, next_retry_ms, status, created_at, updated_at)
         VALUES (?, 'n', 0, 0, ?, ?, ?)`,
      ).run(`r-${s}`, s, now, now);
    }
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM retry_queue")
      .get() as { n: number };
    expect(count.n).toBe(3);
  });
});
