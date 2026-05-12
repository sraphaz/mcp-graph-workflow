/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T09).
 * Tests for the empirical modelHint feedback loop.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { GoldenStore } from "../core/store/golden-store.js";
import { EvalRunStore } from "../core/store/eval-run-store.js";
import {
  computeEmpiricalModelHint,
  type EmpiricalModelHint,
} from "../core/evals/empirical-model-hint.js";

interface SeedRow {
  tool: string;
  model: string;
  passed: boolean;
  costUsd?: number;
}

let _seedSeq = 0;

function seed(
  goldens: GoldenStore,
  runs: EvalRunStore,
  rows: SeedRow[],
): void {
  const cache = new Map<string, string>();
  for (const r of rows) {
    let goldenId = cache.get(r.tool);
    if (!goldenId) {
      const g = goldens.create({
        input: "in",
        expected: "out",
        scorerKind: "exact",
        tool: r.tool,
        projectId: "p",
        metadata: {},
        tags: [],
      });
      goldenId = g.id;
      cache.set(r.tool, goldenId);
    }
    runs.record({
      runId: `r${++_seedSeq}`,
      goldenId,
      score: r.passed ? 1 : 0,
      passed: r.passed,
      modelUsed: r.model,
      costUsd: r.costUsd ?? 0,
    });
  }
}

describe("computeEmpiricalModelHint (E18.T09)", () => {
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

  it("returns null when no eval data exists", () => {
    const hint = computeEmpiricalModelHint(runs, { tool: "analyze" });
    expect(hint).toBeNull();
  });

  it("returns the model with the highest pass-rate for the tool", () => {
    seed(goldens, runs, [
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "analyze", model: "haiku", passed: false },
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
    ]);

    const hint = computeEmpiricalModelHint(runs, { tool: "analyze" }) as EmpiricalModelHint;
    expect(hint).not.toBeNull();
    expect(hint.recommended).toBe("sonnet");
    expect(hint.passRate).toBeCloseTo(1);
    expect(hint.basedOn).toBe(7);
  });

  it("only considers rows for the requested tool", () => {
    seed(goldens, runs, [
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "next", model: "opus", passed: false },
      { tool: "next", model: "opus", passed: false },
      { tool: "next", model: "opus", passed: false },
    ]);

    const hint = computeEmpiricalModelHint(runs, { tool: "analyze" }) as EmpiricalModelHint;
    expect(hint.recommended).toBe("haiku");
    expect(hint.basedOn).toBe(3);
  });

  it("requires minSamples (default 3) per model — ignores under-observed models", () => {
    seed(goldens, runs, [
      // haiku: only 2 samples → ignored
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "analyze", model: "haiku", passed: true },
      // sonnet: 4 samples, lower pass-rate but enough data
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: false },
    ]);

    const hint = computeEmpiricalModelHint(runs, { tool: "analyze" }) as EmpiricalModelHint;
    expect(hint.recommended).toBe("sonnet");
  });

  it("respects a custom minSamples", () => {
    seed(goldens, runs, [
      { tool: "analyze", model: "haiku", passed: true },
      { tool: "analyze", model: "sonnet", passed: false },
    ]);

    const hint = computeEmpiricalModelHint(runs, {
      tool: "analyze",
      minSamples: 1,
    }) as EmpiricalModelHint;
    expect(hint.recommended).toBe("haiku");
  });

  it("respects limit (last N rows considered)", () => {
    seed(goldens, runs, [
      { tool: "analyze", model: "haiku", passed: false },
      { tool: "analyze", model: "haiku", passed: false },
      { tool: "analyze", model: "haiku", passed: false },
    ]);
    seed(goldens, runs, [
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
      { tool: "analyze", model: "sonnet", passed: true },
    ]);

    const hint = computeEmpiricalModelHint(runs, {
      tool: "analyze",
      limit: 3,
      minSamples: 1,
    }) as EmpiricalModelHint;
    // Only the 3 most recent rows considered; all are sonnet wins.
    expect(hint.recommended).toBe("sonnet");
  });

  it("breaks ties by lower avg costUsd (cheaper wins)", () => {
    seed(goldens, runs, [
      { tool: "t", model: "haiku", passed: true, costUsd: 0.001 },
      { tool: "t", model: "haiku", passed: true, costUsd: 0.001 },
      { tool: "t", model: "haiku", passed: true, costUsd: 0.001 },
      { tool: "t", model: "opus", passed: true, costUsd: 0.05 },
      { tool: "t", model: "opus", passed: true, costUsd: 0.05 },
      { tool: "t", model: "opus", passed: true, costUsd: 0.05 },
    ]);

    const hint = computeEmpiricalModelHint(runs, { tool: "t" }) as EmpiricalModelHint;
    expect(hint.recommended).toBe("haiku");
  });
});
