/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T10 — read-only aggregations).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { GoldenStore } from "../core/store/golden-store.js";
import { EvalRunStore } from "../core/store/eval-run-store.js";
import { computeEvalsSummary } from "../core/evals/evals-summary.js";

describe("computeEvalsSummary (E18.T10)", () => {
  let db: Database.Database;
  let goldens: GoldenStore;
  let runs: EvalRunStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    goldens = new GoldenStore(db);
    runs = new EvalRunStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns zeros and empty arrays when no data exists", () => {
    const s = computeEvalsSummary(db);
    expect(s.totalRuns).toBe(0);
    expect(s.totalGoldens).toBe(0);
    expect(s.passRate).toBe(0);
    expect(s.totalCostUsd).toBe(0);
    expect(s.trend).toEqual([]);
    expect(s.topFailing).toEqual([]);
  });

  it("computes overall passRate and totalCostUsd across all eval_run rows", () => {
    const g = goldens.create({
      input: "i",
      expected: "o",
      scorerKind: "exact",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    runs.record({ runId: "r1", goldenId: g.id, score: 1, passed: true, costUsd: 0.01 });
    runs.record({ runId: "r1", goldenId: g.id, score: 0, passed: false, costUsd: 0.02 });
    runs.record({ runId: "r2", goldenId: g.id, score: 1, passed: true, costUsd: 0.03 });

    const s = computeEvalsSummary(db);
    expect(s.totalRuns).toBe(2);
    expect(s.totalGoldens).toBe(1);
    expect(s.passRate).toBeCloseTo(2 / 3);
    expect(s.totalCostUsd).toBeCloseTo(0.06);
  });

  it("topFailing returns goldens with at least one failure, sorted DESC by failures", () => {
    const a = goldens.create({
      input: "in-a",
      expected: "out-a",
      scorerKind: "exact",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    const b = goldens.create({
      input: "in-b",
      expected: "out-b",
      scorerKind: "regex",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    runs.record({ runId: "r", goldenId: a.id, score: 0, passed: false, costUsd: 0 });
    runs.record({ runId: "r", goldenId: a.id, score: 0, passed: false, costUsd: 0 });
    runs.record({ runId: "r", goldenId: b.id, score: 0, passed: false, costUsd: 0 });
    runs.record({ runId: "r", goldenId: b.id, score: 1, passed: true, costUsd: 0 });

    const s = computeEvalsSummary(db);
    expect(s.topFailing.length).toBe(2);
    expect(s.topFailing[0]?.goldenId).toBe(a.id);
    expect(s.topFailing[0]?.failures).toBe(2);
    expect(s.topFailing[0]?.failureRate).toBe(1);
    expect(s.topFailing[1]?.goldenId).toBe(b.id);
    expect(s.topFailing[1]?.failureRate).toBeCloseTo(0.5);
  });

  it("topFailing excludes goldens that always pass", () => {
    const g = goldens.create({
      input: "i",
      expected: "o",
      scorerKind: "exact",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    runs.record({ runId: "r", goldenId: g.id, score: 1, passed: true, costUsd: 0 });
    runs.record({ runId: "r", goldenId: g.id, score: 1, passed: true, costUsd: 0 });
    const s = computeEvalsSummary(db);
    expect(s.topFailing).toEqual([]);
  });

  it("topFailing respects topFailingLimit", () => {
    for (let i = 0; i < 5; i++) {
      const g = goldens.create({
        input: `i${i}`,
        expected: `o${i}`,
        scorerKind: "exact",
        tool: "t",
        projectId: "p",
        metadata: {},
        tags: [],
      });
      runs.record({ runId: "r", goldenId: g.id, score: 0, passed: false, costUsd: 0 });
    }
    const s = computeEvalsSummary(db, { topFailingLimit: 2 });
    expect(s.topFailing.length).toBe(2);
  });

  it("trend buckets eval_run rows by date with passRate per day", () => {
    const g = goldens.create({
      input: "i",
      expected: "o",
      scorerKind: "exact",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    runs.record({ runId: "r", goldenId: g.id, score: 1, passed: true, costUsd: 0.01 });
    runs.record({ runId: "r", goldenId: g.id, score: 0, passed: false, costUsd: 0.02 });

    const s = computeEvalsSummary(db);
    expect(s.trend.length).toBe(1);
    const day = s.trend[0]!;
    expect(day.total).toBe(2);
    expect(day.passed).toBe(1);
    expect(day.passRate).toBeCloseTo(0.5);
    expect(day.totalCostUsd).toBeCloseTo(0.03);
    expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
