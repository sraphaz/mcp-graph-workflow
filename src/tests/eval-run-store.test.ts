/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T07).
 * Tests for EvalRunStore (eval_run CRUD + aggregate).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { GoldenStore } from "../core/store/golden-store.js";
import { EvalRunStore } from "../core/store/eval-run-store.js";

describe("EvalRunStore (E18.T07)", () => {
  let db: Database.Database;
  let goldens: GoldenStore;
  let runs: EvalRunStore;
  let goldenId: string;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    goldens = new GoldenStore(db);
    runs = new EvalRunStore(db);
    const g = goldens.create({
      input: "in",
      expected: "out",
      scorerKind: "exact",
      tool: "analyze",
      projectId: "p1",
      metadata: {},
      tags: [],
    });
    goldenId = g.id;
  });

  afterEach(() => {
    db.close();
  });

  it("record persists row and returns generated id", () => {
    const r = runs.record({
      runId: "run-1",
      goldenId,
      score: 0.95,
      passed: true,
      latencyMs: 100,
      modelUsed: "haiku",
      costUsd: 0.0012,
    });
    expect(r.id).toBeTruthy();
    expect(r.runId).toBe("run-1");
  });

  it("listByRunId returns rows for a run", () => {
    runs.record({ runId: "r", goldenId, score: 1, passed: true, costUsd: 0.001 });
    runs.record({ runId: "r", goldenId, score: 0, passed: false, costUsd: 0.002 });
    runs.record({ runId: "other", goldenId, score: 1, passed: true, costUsd: 0.003 });
    const rows = runs.listByRunId("r");
    expect(rows.length).toBe(2);
  });

  it("aggregate returns passRate and totalCostUsd for a run", () => {
    runs.record({ runId: "r", goldenId, score: 1, passed: true, costUsd: 0.001 });
    runs.record({ runId: "r", goldenId, score: 0.5, passed: true, costUsd: 0.002 });
    runs.record({ runId: "r", goldenId, score: 0, passed: false, costUsd: 0.003 });
    const agg = runs.aggregate("r");
    expect(agg.total).toBe(3);
    expect(agg.passed).toBe(2);
    expect(agg.passRate).toBeCloseTo(2 / 3);
    expect(agg.totalCostUsd).toBeCloseTo(0.006);
  });

  it("aggregate handles empty run", () => {
    const agg = runs.aggregate("missing");
    expect(agg.total).toBe(0);
    expect(agg.passed).toBe(0);
    expect(agg.passRate).toBe(0);
    expect(agg.totalCostUsd).toBe(0);
  });

  it("perModelStats groups by model_used", () => {
    runs.record({ runId: "r", goldenId, score: 1, passed: true, modelUsed: "haiku", costUsd: 0.001 });
    runs.record({ runId: "r", goldenId, score: 0, passed: false, modelUsed: "haiku", costUsd: 0.001 });
    runs.record({ runId: "r", goldenId, score: 1, passed: true, modelUsed: "sonnet", costUsd: 0.005 });
    const stats = runs.perModelStats("r");
    const byModel = new Map(stats.map((s) => [s.modelUsed, s]));
    expect(byModel.get("haiku")?.passRate).toBeCloseTo(0.5);
    expect(byModel.get("sonnet")?.passRate).toBeCloseTo(1);
  });
});
