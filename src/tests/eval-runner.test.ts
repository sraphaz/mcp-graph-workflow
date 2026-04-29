/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T07).
 * Tests for runEvals orchestrator.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { GoldenStore } from "../core/store/golden-store.js";
import { EvalRunStore } from "../core/store/eval-run-store.js";
import { runEvals, type EvalDispatch } from "../core/evals/eval-runner.js";

describe("runEvals (E18.T07)", () => {
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

  it("runs each golden through scorer and returns summary with passRate + per-row + totalCostUsd", async () => {
    goldens.create({
      input: "2+2",
      expected: "4",
      scorerKind: "exact",
      tool: "math",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    goldens.create({
      input: "3+3",
      expected: "6",
      scorerKind: "exact",
      tool: "math",
      projectId: "p",
      metadata: {},
      tags: [],
    });

    // Dispatch returns "4" for both — first passes, second fails.
    const dispatch: EvalDispatch = async () => ({
      output: "4",
      modelUsed: "haiku",
      costUsd: 0.0005,
      latencyMs: 50,
    });

    const summary = await runEvals({ goldens, runs, dispatch });
    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBeCloseTo(0.5);
    expect(summary.totalCostUsd).toBeCloseTo(0.001);
    expect(summary.perRow.length).toBe(2);
    expect(summary.runId).toBeTruthy();
  });

  it("filters by tool when filter.tool is set", async () => {
    goldens.create({
      input: "x",
      expected: "x",
      scorerKind: "exact",
      tool: "a",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    goldens.create({
      input: "y",
      expected: "y",
      scorerKind: "exact",
      tool: "b",
      projectId: "p",
      metadata: {},
      tags: [],
    });

    const dispatch: EvalDispatch = async (g) => ({ output: g.expected, costUsd: 0 });
    const summary = await runEvals({ goldens, runs, dispatch, filter: { tool: "b" } });
    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(1);
  });

  it("perRow includes goldenId, score, passed, output, expected", async () => {
    goldens.create({
      input: "q",
      expected: "ok",
      scorerKind: "exact",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    const dispatch: EvalDispatch = async () => ({ output: "ok", costUsd: 0 });
    const summary = await runEvals({ goldens, runs, dispatch });
    const row = summary.perRow[0]!;
    expect(row.goldenId).toBeTruthy();
    expect(row.score).toBe(1);
    expect(row.passed).toBe(true);
    expect(row.output).toBe("ok");
    expect(row.expected).toBe("ok");
  });

  it("supports regex scorerKind (built-in)", async () => {
    goldens.create({
      input: "q",
      expected: "^v\\d+$",
      scorerKind: "regex",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    const dispatch: EvalDispatch = async () => ({ output: "v42", costUsd: 0 });
    const summary = await runEvals({ goldens, runs, dispatch });
    expect(summary.passed).toBe(1);
  });

  it("returns score=0 + passed=false when scorerKind is unknown (no crash)", async () => {
    goldens.create({
      input: "q",
      expected: "x",
      scorerKind: "no-such-scorer",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    const dispatch: EvalDispatch = async () => ({ output: "x", costUsd: 0 });
    const summary = await runEvals({ goldens, runs, dispatch });
    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(0);
  });

  it("persists eval_run rows under shared runId", async () => {
    goldens.create({
      input: "q",
      expected: "x",
      scorerKind: "exact",
      tool: "t",
      projectId: "p",
      metadata: {},
      tags: [],
    });
    const dispatch: EvalDispatch = async () => ({
      output: "x",
      costUsd: 0.01,
      modelUsed: "haiku",
    });
    const summary = await runEvals({ goldens, runs, dispatch });
    const persisted = runs.listByRunId(summary.runId);
    expect(persisted.length).toBe(1);
    expect(persisted[0]!.modelUsed).toBe("haiku");
    expect(persisted[0]!.costUsd).toBeCloseTo(0.01);
  });
});
