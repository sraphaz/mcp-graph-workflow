/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-18.AC5 — task-readiness empirical override tests.
 */

import { describe, it, expect } from "vitest";
import {
  computeTaskReadinessScore,
  MIN_EMPIRICAL_SAMPLES,
} from "../core/planner/task-readiness-score.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

const baseNode: GraphNode = {
  id: "node_test",
  type: "task",
  title: "test task",
  status: "ready",
  priority: 3,
  blocked: false,
  createdAt: "2026-04-29T00:00:00Z",
  updatedAt: "2026-04-29T00:00:00Z",
  xpSize: "S",
  acceptanceCriteria: [
    "GIVEN x WHEN y THEN result===42",
    "GIVEN a WHEN b THEN out===true",
  ],
};

function makeDoc(nodes: GraphNode[]): GraphDocument {
  return {
    project: "test",
    version: "1.0",
    nodes,
    edges: [],
    indexes: { byId: new Map(), byType: new Map(), byStatus: new Map() },
    meta: { generatedAt: "2026-04-29T00:00:00Z" },
  } as unknown as GraphDocument;
}

const baseDoc = makeDoc([baseNode]);

describe("task-readiness empirical override (E18.AC5)", () => {
  it("MIN_EMPIRICAL_SAMPLES is 5", () => {
    expect(MIN_EMPIRICAL_SAMPLES).toBe(5);
  });

  it("empirical override is taken when basedOn >= MIN_EMPIRICAL_SAMPLES", () => {
    const r = computeTaskReadinessScore(baseNode, baseDoc, {
      empiricalOverride: { model: "opus", basedOn: 10, passRate: 0.9 },
    });
    expect(r.overridden).toBe("empirical");
    expect(r.recommendation).toBe("opus");
    expect(r.rationale.some((s) => s.includes("empirical override"))).toBe(true);
  });

  it("empirical override is IGNORED when basedOn < MIN_EMPIRICAL_SAMPLES", () => {
    const r = computeTaskReadinessScore(baseNode, baseDoc, {
      empiricalOverride: { model: "opus", basedOn: 4, passRate: 0.95 },
    });
    expect(r.overridden).not.toBe("empirical");
    expect(r.recommendation).not.toBe("opus");
  });

  it("high_stake_type still beats empirical override (architecture > telemetry)", () => {
    const decisionNode: GraphNode = { ...baseNode, type: "decision" };
    const docWithDecision = makeDoc([decisionNode]);
    const r = computeTaskReadinessScore(decisionNode, docWithDecision, {
      empiricalOverride: { model: "haiku", basedOn: 50, passRate: 0.99 },
    });
    expect(r.overridden).toBe("high_stake_type");
    expect(r.recommendation).toBe("opus");
  });

  it("empirical override beats no_testable_ac escalation", () => {
    const nodeNoAc: GraphNode = { ...baseNode, acceptanceCriteria: [] };
    const docNoAc = makeDoc([nodeNoAc]);
    const r = computeTaskReadinessScore(nodeNoAc, docNoAc, {
      empiricalOverride: { model: "haiku", basedOn: 20, passRate: 0.85 },
    });
    expect(r.overridden).toBe("empirical");
    expect(r.recommendation).toBe("haiku");
  });

  it("rationale string mentions passRate and sample count", () => {
    const r = computeTaskReadinessScore(baseNode, baseDoc, {
      empiricalOverride: { model: "sonnet", basedOn: 12, passRate: 0.75 },
    });
    const rationale = r.rationale.join(" ");
    expect(rationale).toContain("0.75");
    expect(rationale).toContain("12");
  });
});
