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

describe("Migration 71 — eval_golden + eval_run (EPIC 18 Evals + Golden Dataset)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create eval_golden table with required columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(eval_golden)")
      .all() as Array<{ name: string; type: string }>;

    const names = new Set(columns.map((c) => c.name));
    for (const col of [
      "id",
      "input",
      "expected",
      "scorer_kind",
      "tool",
      "project_id",
      "metadata",
      "tags",
      "created_at",
    ]) {
      expect(names.has(col), `missing eval_golden.${col}`).toBe(true);
    }
  });

  it("should create eval_run table with required columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(eval_run)")
      .all() as Array<{ name: string; type: string }>;

    const names = new Set(columns.map((c) => c.name));
    for (const col of [
      "id",
      "run_id",
      "golden_id",
      "score",
      "passed",
      "latency_ms",
      "model_used",
      "cost_usd",
      "created_at",
    ]) {
      expect(names.has(col), `missing eval_run.${col}`).toBe(true);
    }
  });

  it("should create indexes on eval_golden (tool, project_id, scorer_kind)", () => {
    const indexes = db
      .prepare("PRAGMA index_list(eval_golden)")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("eval_golden") && n.includes("tool"))).toBe(true);
    expect(names.some((n) => n.includes("eval_golden") && n.includes("project"))).toBe(true);
  });

  it("should create indexes on eval_run (run_id, golden_id)", () => {
    const indexes = db
      .prepare("PRAGMA index_list(eval_run)")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names.some((n) => n.includes("eval_run") && n.includes("run"))).toBe(true);
    expect(names.some((n) => n.includes("eval_run") && n.includes("golden"))).toBe(true);
  });

  it("should accept INSERT into eval_golden", () => {
    expect(() => {
      db.prepare(
        `INSERT INTO eval_golden (id, input, expected, scorer_kind, tool, project_id, metadata, tags, created_at)
         VALUES ('g1', 'in', 'out', 'exact', 'analyze', 'p1', '{}', '["tag1"]', '2026-04-29T00:00:00Z')`,
      ).run();
    }).not.toThrow();

    const row = db.prepare("SELECT * FROM eval_golden WHERE id = 'g1'").get() as {
      input: string;
      expected: string;
      scorer_kind: string;
      tool: string;
    };
    expect(row.input).toBe("in");
    expect(row.scorer_kind).toBe("exact");
  });

  it("should accept INSERT into eval_run with score+passed+cost", () => {
    db.prepare(
      `INSERT INTO eval_golden (id, input, expected, scorer_kind, tool, project_id, metadata, tags, created_at)
       VALUES ('g1', 'in', 'out', 'exact', 'analyze', 'p1', '{}', '[]', '2026-04-29T00:00:00Z')`,
    ).run();

    expect(() => {
      db.prepare(
        `INSERT INTO eval_run (id, run_id, golden_id, score, passed, latency_ms, model_used, cost_usd, created_at)
         VALUES ('r1', 'run-1', 'g1', 0.95, 1, 123, 'haiku', 0.0012, '2026-04-29T00:00:00Z')`,
      ).run();
    }).not.toThrow();

    const row = db.prepare("SELECT * FROM eval_run WHERE id = 'r1'").get() as {
      score: number;
      passed: number;
      cost_usd: number;
      model_used: string;
    };
    expect(row.score).toBe(0.95);
    expect(row.passed).toBe(1);
    expect(row.model_used).toBe("haiku");
    expect(row.cost_usd).toBeCloseTo(0.0012);
  });

  it("should be tracked as version 71 in _migrations", () => {
    const m = db
      .prepare("SELECT version, description FROM _migrations WHERE version = 71")
      .get() as { version: number; description: string } | undefined;

    expect(m).toBeDefined();
    expect(m?.version).toBe(71);
    expect(m?.description.toLowerCase()).toMatch(/eval|golden|epic 18/);
  });
});
