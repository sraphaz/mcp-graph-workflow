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

/**
 * TDD: harness regression report — getHarnessRegressionReport
 *
 * Tests for the post-check regression detection used in finish_task.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { getHarnessRegressionReport } from "../../core/harness/harness-preflight.js";

describe("getHarnessRegressionReport", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = new BetterSqlite3(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns null when no previous history exists", () => {
    const result = getHarnessRegressionReport(db, 70);
    expect(result).toBeNull();
  });

  it("returns null when only 1 entry exists (no previous to compare)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_1", "test", 70, "B", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessRegressionReport(db, 70);
    expect(result).toBeNull();
  });

  it("returns regression when score dropped > 5 points", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_old", "test", 75, "B", "{}", "2026-04-10T10:00:00Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_new", "test", 65, "C", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessRegressionReport(db, 65);
    expect(result).not.toBeNull();
    expect(result!.before).toBe(75);
    expect(result!.after).toBe(65);
    expect(result!.delta).toBe(-10);
  });

  it("returns null when score dropped <= 5 points", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_old", "test", 75, "B", "{}", "2026-04-10T10:00:00Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_new", "test", 72, "B", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessRegressionReport(db, 72);
    expect(result).toBeNull();
  });

  it("returns null when score improved", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_old", "test", 70, "B", "{}", "2026-04-10T10:00:00Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_new", "test", 80, "B", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessRegressionReport(db, 80);
    expect(result).toBeNull();
  });
});
