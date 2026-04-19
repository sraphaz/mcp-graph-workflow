/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";

describe("Migration v33 — harness_history table", () => {
  let db: ReturnType<typeof BetterSqlite3>;

  beforeEach(() => {
    db = new BetterSqlite3(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("migrations applied include v33", () => {
    const row = db
      .prepare("SELECT version FROM _migrations WHERE version = 33")
      .get() as { version: number } | undefined;
    expect(row).toBeDefined();
    expect(row?.version).toBe(33);
  });

  it("migration v33 creates harness_history table", () => {
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='harness_history'",
      )
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe("harness_history");
  });

  it("harness_history table has correct columns", () => {
    const cols = db
      .prepare("PRAGMA table_info(harness_history)")
      .all() as Array<{ name: string; type: string; notnull: number; pk: number }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("project_id");
    expect(names).toContain("score");
    expect(names).toContain("grade");
    expect(names).toContain("breakdown");
    expect(names).toContain("git_commit");
    expect(names).toContain("timestamp");
  });

  it("can insert and query harness_history row", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("test-id-1", "proj_abc", 82.5, "B", '{"types":{"score":90}}', "abc123", "2026-01-01T00:00:00.000Z");

    const row = db
      .prepare("SELECT * FROM harness_history WHERE id = ?")
      .get("test-id-1") as Record<string, unknown>;
    expect(row.score).toBe(82.5);
    expect(row.grade).toBe("B");
  });

  it("can query by project_id ordered by timestamp DESC", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("h1", "proj_x", 70.0, "C", "{}", null, "2026-01-01T00:00:00.000Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("h2", "proj_x", 80.0, "B", "{}", null, "2026-01-02T00:00:00.000Z");

    const rows = db
      .prepare(
        "SELECT * FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 10",
      )
      .all("proj_x") as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("h2");
  });

  it("does not break existing tables (nodes table still exists)", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'")
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
  });
});
