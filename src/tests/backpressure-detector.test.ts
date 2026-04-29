/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C2 — backpressure detector tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { checkBackpressure, getCurrentWip } from "../core/autonomy/backpressure-detector.js";

function seedNode(db: Database.Database, id: string, status: string): void {
  const now = "2026-04-29T00:00:00Z";
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, created_at, updated_at)
     VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
  ).run();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
     VALUES (?, 'p1', 'subtask', 'T', ?, 3, ?, ?)`,
  ).run(id, status, now, now);
}

describe("backpressure-detector (E22.C2)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("getCurrentWip returns 0 on empty graph", () => {
    expect(getCurrentWip(db)).toBe(0);
  });

  it("getCurrentWip counts only in_progress nodes", () => {
    seedNode(db, "n1", "in_progress");
    seedNode(db, "n2", "in_progress");
    seedNode(db, "n3", "ready");
    seedNode(db, "n4", "done");
    expect(getCurrentWip(db)).toBe(2);
  });

  it("blocked=true when WIP >= capacity", () => {
    seedNode(db, "n1", "in_progress");
    seedNode(db, "n2", "in_progress");
    const state = checkBackpressure(db, 2);
    expect(state.blocked).toBe(true);
    expect(state.wip).toBe(2);
    expect(state.capacity).toBe(2);
  });

  it("blocked=false when WIP < capacity", () => {
    seedNode(db, "n1", "in_progress");
    const state = checkBackpressure(db, 4);
    expect(state.blocked).toBe(false);
    expect(state.wip).toBe(1);
  });

  it("scenario: pool size 2 + 3 ready tasks → first 2 promoted, third stays ready (advisory)", () => {
    seedNode(db, "ready1", "ready");
    seedNode(db, "ready2", "ready");
    seedNode(db, "ready3", "ready");

    expect(checkBackpressure(db, 2).blocked).toBe(false);
    db.prepare(`UPDATE nodes SET status = 'in_progress' WHERE id = 'ready1'`).run();
    expect(checkBackpressure(db, 2).blocked).toBe(false);
    db.prepare(`UPDATE nodes SET status = 'in_progress' WHERE id = 'ready2'`).run();
    expect(checkBackpressure(db, 2).blocked).toBe(true);

    const remainingReady = db
      .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE status = 'ready'`)
      .get() as { n: number };
    expect(remainingReady.n).toBe(1);
  });
});
