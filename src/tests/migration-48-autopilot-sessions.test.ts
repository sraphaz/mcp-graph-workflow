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
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 48 — autopilot_sessions table (Hewitt Actor Model)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create autopilot_sessions table with correct columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(autopilot_sessions)")
      .all() as Array<{ name: string; type: string }>;

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("sprint_id");
    expect(columnNames).toContain("started_at");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("tasks_completed");
    expect(columnNames).toContain("tasks_failed");
    expect(columnNames).toContain("tokens_used");
    expect(columnNames).toContain("config");
    expect(columnNames).toContain("decisions");
  });

  it("should have index on (sprint_id, status)", () => {
    const indexes = db
      .prepare("PRAGMA index_list(autopilot_sessions)")
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_autopilot_sessions_sprint_status");
  });

  it("should persist session with JSON config correctly", () => {
    const now = new Date().toISOString();
    const config = JSON.stringify({ maxFailures: 2, checkpointEvery: 5 });

    db.prepare(
      `INSERT INTO autopilot_sessions (id, sprint_id, started_at, status, tasks_completed, tasks_failed, tokens_used, config, decisions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("session-1", "sprint-a", now, "running", 0, 0, 0, config, "[]");

    const row = db.prepare("SELECT * FROM autopilot_sessions WHERE id = ?")
      .get("session-1") as Record<string, unknown>;

    expect(row.sprint_id).toBe("sprint-a");
    expect(row.status).toBe("running");
    expect(JSON.parse(row.config as string)).toEqual({ maxFailures: 2, checkpointEvery: 5 });
  });
});
