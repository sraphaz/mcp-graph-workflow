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

describe("Migration 47 — token_budget_policy table (Sutton & Barto RL)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create token_budget_policy table with correct columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(token_budget_policy)")
      .all() as Array<{ name: string; type: string }>;

    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("state_phase");
    expect(columnNames).toContain("state_grade");
    expect(columnNames).toContain("action_preset");
    expect(columnNames).toContain("q_value");
    expect(columnNames).toContain("visits");
    expect(columnNames).toContain("updated_at");
  });

  it("should have correct column types", () => {
    const columns = db
      .prepare("PRAGMA table_info(token_budget_policy)")
      .all() as Array<{ name: string; type: string }>;

    const colMap = new Map(columns.map((c) => [c.name, c.type]));

    expect(colMap.get("state_phase")).toBe("TEXT");
    expect(colMap.get("state_grade")).toBe("TEXT");
    expect(colMap.get("action_preset")).toBe("TEXT");
    expect(colMap.get("q_value")).toBe("REAL");
    expect(colMap.get("visits")).toBe("INTEGER");
    expect(colMap.get("updated_at")).toBe("TEXT");
  });

  it("should have 180 default rows (9 phases × 4 grades × 5 presets)", () => {
    const count = db
      .prepare("SELECT count(*) as cnt FROM token_budget_policy")
      .get() as { cnt: number };

    expect(count.cnt).toBe(180);
  });

  it("should have all 9 lifecycle phases", () => {
    const phases = db
      .prepare("SELECT DISTINCT state_phase FROM token_budget_policy ORDER BY state_phase")
      .all() as Array<{ state_phase: string }>;

    const phaseNames = phases.map((p) => p.state_phase);
    expect(phaseNames).toContain("ANALYZE");
    expect(phaseNames).toContain("DESIGN");
    expect(phaseNames).toContain("PLAN");
    expect(phaseNames).toContain("IMPLEMENT");
    expect(phaseNames).toContain("VALIDATE");
    expect(phaseNames).toContain("REVIEW");
    expect(phaseNames).toContain("HANDOFF");
    expect(phaseNames).toContain("DEPLOY");
    expect(phaseNames).toContain("LISTENING");
    expect(phases).toHaveLength(9);
  });

  it("should have all 4 harness grades", () => {
    const grades = db
      .prepare("SELECT DISTINCT state_grade FROM token_budget_policy ORDER BY state_grade")
      .all() as Array<{ state_grade: string }>;

    const gradeNames = grades.map((g) => g.state_grade);
    expect(gradeNames).toContain("A");
    expect(gradeNames).toContain("B");
    expect(gradeNames).toContain("C");
    expect(gradeNames).toContain("D");
    expect(grades).toHaveLength(4);
  });

  it("should have all 5 budget presets", () => {
    const presets = db
      .prepare("SELECT DISTINCT action_preset FROM token_budget_policy ORDER BY action_preset")
      .all() as Array<{ action_preset: string }>;

    expect(presets).toHaveLength(5);
  });

  it("should have default q_value of 0 and visits of 0", () => {
    const row = db
      .prepare("SELECT q_value, visits FROM token_budget_policy LIMIT 1")
      .get() as { q_value: number; visits: number };

    expect(row.q_value).toBe(0);
    expect(row.visits).toBe(0);
  });

  it("should enforce unique constraint on (state_phase, state_grade, action_preset)", () => {
    expect(() => {
      db.prepare(
        `INSERT INTO token_budget_policy (state_phase, state_grade, action_preset, q_value, visits, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("IMPLEMENT", "A", "balanced", 0, 0, new Date().toISOString());
    }).toThrow();
  });
});
