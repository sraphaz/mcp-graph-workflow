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

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { DatasetStore } from "../../core/observability/dataset-store.js";
import { ExperimentRunner } from "../../core/observability/experiment-runner.js";
import { TraceStore } from "../../core/observability/trace-store.js";
import { DecisionStore } from "../../core/observability/decision-store.js";
import { runMigrations } from "../../core/store/migrations.js";

describe("DatasetStore", () => {
  let db: Database.Database;
  let store: DatasetStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new DatasetStore(db);
  });

  it("should create dataset and return id", () => {
    const id = store.createDataset("test_dataset", "manual");

    expect(id).toMatch(/^dataset_/);

    const dataset = store.getDataset(id);
    expect(dataset).not.toBeNull();
    expect(dataset!.name).toBe("test_dataset");
    expect(dataset!.source).toBe("manual");
  });

  it("should add entries to dataset", () => {
    const datasetId = store.createDataset("test", "manual");

    store.addEntry(datasetId, { query: "test query" }, { answer: "expected" });
    store.addEntry(datasetId, { query: "another" });

    const entries = store.getEntries(datasetId);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.input).toEqual({ query: "test query" });
    expect(entries[0]!.expectedOutput).toEqual({ answer: "expected" });
    expect(entries[1]!.expectedOutput).toBeNull();
  });

  it("should capture dataset from traces", () => {
    const traceStore = new TraceStore(db);
    const t1 = traceStore.beginTrace("thread_1", "node_1", "start_task");
    traceStore.endTrace(t1, "completed", { tokensIn: 100, tokensOut: 50 });
    const t2 = traceStore.beginTrace("thread_1", "node_2", "finish_task");
    traceStore.endTrace(t2, "completed", { tokensIn: 200, tokensOut: 100 });

    const datasetId = store.captureFromTraces("from_traces_test", [t1, t2]);

    const entries = store.getEntries(datasetId);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.input).toHaveProperty("traceId", t1);
  });

  it("should capture dataset from decisions", () => {
    const traceStore = new TraceStore(db);
    const decisionStore = new DecisionStore(db);

    const traceId = traceStore.beginTrace("thread_1", "node_1", "start_task");
    decisionStore.record({
      traceId,
      nodeId: "node_1",
      decision: "continue",
      confidenceScore: 85,
      evidence: {
        ragRelevance: 0.9, harnessScore: 80, historicalSuccessRate: 0.85,
        ragContribution: 36, harnessContribution: 24, historicalContribution: 25.5,
      },
      weightsUsed: { rag: 0.4, harness: 0.3, historical: 0.3 },
      policyName: "default",
    });

    const datasetId = store.captureFromDecisions("decision_test", db);

    const entries = store.getEntries(datasetId);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.input).toHaveProperty("nodeId", "node_1");
  });

  it("should return entry count", () => {
    const datasetId = store.createDataset("counted", "manual");
    store.addEntry(datasetId, { a: 1 });
    store.addEntry(datasetId, { b: 2 });

    expect(store.getEntryCount(datasetId)).toBe(2);
  });
});

describe("ExperimentRunner", () => {
  let db: Database.Database;
  let datasetStore: DatasetStore;
  let runner: ExperimentRunner;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    datasetStore = new DatasetStore(db);
    runner = new ExperimentRunner(db);
  });

  it("should create experiment", () => {
    const datasetId = datasetStore.createDataset("exp_dataset", "manual");
    datasetStore.addEntry(datasetId, { value: 42 }, { expected: 42 });

    const expId = runner.createExperiment("test_exp", datasetId, { evaluators: ["exact_match"] });

    expect(expId).toMatch(/^exp_/);
    const exp = runner.getExperiment(expId);
    expect(exp!.name).toBe("test_exp");
    expect(exp!.status).toBe("pending");
  });

  it("should run experiment with exact_match evaluator and compute scores", () => {
    const datasetId = datasetStore.createDataset("match_test", "manual");
    datasetStore.addEntry(datasetId, { value: "hello" }, { value: "hello" });
    datasetStore.addEntry(datasetId, { value: "world" }, { value: "different" });

    const expId = runner.createExperiment("match_exp", datasetId, {
      evaluators: ["exact_match"],
      targetFn: (input: Record<string, unknown>) => input, // identity — returns input as output
    });

    const summary = runner.runExperiment(expId);

    expect(summary).not.toBeNull();
    expect(summary!.status).toBe("completed");
    expect(summary!.resultCount).toBe(2);
    // First entry matches (input == expected), second doesn't
    expect(summary!.avgScores["exact_match"]).toBe(0.5);
  });

  it("should compare two experiments side-by-side", () => {
    const datasetId = datasetStore.createDataset("compare_ds", "manual");
    datasetStore.addEntry(datasetId, { v: 1 }, { v: 1 });
    datasetStore.addEntry(datasetId, { v: 2 }, { v: 2 });

    const exp1 = runner.createExperiment("exp_a", datasetId, {
      evaluators: ["exact_match"],
      targetFn: (input: Record<string, unknown>) => input,
    });
    runner.runExperiment(exp1);

    const exp2 = runner.createExperiment("exp_b", datasetId, {
      evaluators: ["exact_match"],
      targetFn: () => ({ v: 1 }), // only matches first entry
    });
    runner.runExperiment(exp2);

    const comparison = runner.compareExperiments(exp1, exp2);
    expect(comparison).not.toBeNull();
    expect(comparison!.exp1Name).toBe("exp_a");
    expect(comparison!.exp2Name).toBe("exp_b");
    expect(comparison!.exp1Scores["exact_match"]).toBe(1.0);
    expect(comparison!.exp2Scores["exact_match"]).toBe(0.5);
  });
});
