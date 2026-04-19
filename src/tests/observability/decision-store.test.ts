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
import { DecisionStore } from "../../core/observability/decision-store.js";
import { TraceStore } from "../../core/observability/trace-store.js";
import { runMigrations } from "../../core/store/migrations.js";
import type { ConfidenceEvidence } from "../../core/autonomy/confidence-scorer.js";

describe("DecisionStore", () => {
  let db: Database.Database;
  let store: DecisionStore;
  let traceStore: TraceStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new DecisionStore(db);
    traceStore = new TraceStore(db);
  });

  const sampleEvidence: ConfidenceEvidence = {
    ragRelevance: 0.85,
    harnessScore: 75,
    historicalSuccessRate: 0.9,
    ragContribution: 34,
    harnessContribution: 22.5,
    historicalContribution: 27,
  };

  const defaultWeights = { rag: 0.40, harness: 0.30, historical: 0.30 };

  // ── Record & query ───────────────────────────────────

  it("should record decision with full evidence", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "start_task");

    store.record({
      traceId,
      nodeId: "node_1",
      decision: "continue",
      confidenceScore: 83.5,
      evidence: sampleEvidence,
      weightsUsed: defaultWeights,
      policyName: "default",
      guardrailPassRate: 1.0,
    });

    const decisions = store.getByNode("node_1");
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.decision).toBe("continue");
    expect(decisions[0]!.confidenceScore).toBe(83.5);
    expect(decisions[0]!.policyName).toBe("default");
    expect(decisions[0]!.outcome).toBeNull();
  });

  it("should query decisions by trace", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "start_task");

    store.record({
      traceId,
      nodeId: "node_1",
      decision: "continue",
      confidenceScore: 80,
      evidence: sampleEvidence,
      weightsUsed: defaultWeights,
    });

    const decisions = store.getByTrace(traceId);
    expect(decisions).toHaveLength(1);
  });

  // ── Outcome tracking ─────────────────────────────────

  it("should record outcome and close the loop", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "start_task");

    store.record({
      traceId,
      nodeId: "node_1",
      decision: "continue",
      confidenceScore: 80,
      evidence: sampleEvidence,
      weightsUsed: defaultWeights,
    });

    const decisions = store.getByNode("node_1");
    const decisionId = decisions[0]!.id;

    store.recordOutcome(decisionId, "success");

    const updated = store.getByNode("node_1");
    expect(updated[0]!.outcome).toBe("success");
  });

  // ── Replay (T3 — Counterfactual Analysis) ────────────

  it("should replay decision with alternative weights", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "start_task");

    store.record({
      traceId,
      nodeId: "node_1",
      decision: "continue",
      confidenceScore: 83.5,
      evidence: sampleEvidence,
      weightsUsed: defaultWeights,
    });

    const decisions = store.getByNode("node_1");
    const decisionId = decisions[0]!.id;

    // Conservative policy — more weight on RAG
    const replayed = store.replay(decisionId, { rag: 0.50, harness: 0.30, historical: 0.20 });

    expect(replayed).not.toBeNull();
    expect(replayed!.score).toBeGreaterThan(0);
    // With higher RAG weight (0.85 relevance), score should change
    expect(replayed!.score).not.toBe(83.5);
    expect(replayed!.action).toBeDefined();
  });

  it("should return null when replaying nonexistent decision", () => {
    const replayed = store.replay("nonexistent", defaultWeights);
    expect(replayed).toBeNull();
  });

  // ── Accuracy tracking (Bayesian posterior) ────────────

  it("should compute accuracy by policy name", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "start_task");

    // 3 decisions: 2 continue→success, 1 continue→failure
    for (let i = 0; i < 3; i++) {
      store.record({
        traceId,
        nodeId: `node_${i}`,
        decision: "continue",
        confidenceScore: 80,
        evidence: sampleEvidence,
        weightsUsed: defaultWeights,
        policyName: "default",
      });
    }

    const decisions = store.getByTrace(traceId);
    store.recordOutcome(decisions[0]!.id, "success");
    store.recordOutcome(decisions[1]!.id, "success");
    store.recordOutcome(decisions[2]!.id, "failure");

    const accuracy = store.getAccuracyByPolicy("default");
    expect(accuracy.total).toBe(3);
    expect(accuracy.correct).toBe(2);
    expect(accuracy.accuracy).toBeCloseTo(2 / 3);
  });

  it("should return zero accuracy for unknown policy", () => {
    const accuracy = store.getAccuracyByPolicy("unknown");
    expect(accuracy.total).toBe(0);
    expect(accuracy.correct).toBe(0);
    expect(accuracy.accuracy).toBe(0);
  });
});
