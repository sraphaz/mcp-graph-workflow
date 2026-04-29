/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-23.T01 — PRD lifecycle health aggregator tests.
 */

import { describe, it, expect } from "vitest";
import { computePrdLifecycleHealth } from "../core/analyzer/prd-lifecycle-health.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

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

const epic: GraphNode = {
  id: "epic_1",
  type: "epic",
  title: "test epic",
  status: "in_progress",
  priority: 2,
  blocked: false,
  createdAt: "2026-04-29T00:00:00Z",
  updatedAt: "2026-04-29T00:00:00Z",
  acceptanceCriteria: [
    "GIVEN x WHEN y THEN result === 42",
    "GIVEN a WHEN b THEN out === true",
  ],
};

const goodTask: GraphNode = {
  id: "task_1",
  type: "task",
  parentId: "epic_1",
  title: "good task",
  status: "done",
  priority: 3,
  blocked: false,
  createdAt: "2026-04-29T00:00:00Z",
  updatedAt: "2026-04-29T00:00:00Z",
  xpSize: "S",
  testFiles: ["src/tests/foo.test.ts"],
  acceptanceCriteria: [
    "GIVEN p WHEN q THEN r === 1",
    "GIVEN s WHEN t THEN u === 2",
  ],
};

describe("PRD lifecycle health (E23.T01)", () => {
  it("throws when epic node not found", () => {
    expect(() => computePrdLifecycleHealth(makeDoc([]), "missing")).toThrow();
  });

  it("returns 9 phases with binary pass/fail", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      harnessGrade: "B",
    });
    expect(Object.keys(r.phases)).toEqual([
      "ANALYZE",
      "DESIGN",
      "PLAN",
      "IMPLEMENT",
      "VALIDATE",
      "REVIEW",
      "HANDOFF",
      "DEPLOY",
      "LISTENING",
    ]);
    for (const phase of Object.values(r.phases)) {
      expect(typeof phase.passed).toBe("boolean");
    }
  });

  it("reports passedCount and passedAll consistently", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      harnessGrade: "A",
    });
    const trueCount = Object.values(r.phases).filter((p) => p.passed).length;
    expect(r.passedCount).toBe(trueCount);
    expect(r.passedAll).toBe(trueCount === 9);
  });

  it("IMPLEMENT phase fails when done tasks lack testFiles", () => {
    const noTest: GraphNode = { ...goodTask, id: "task_no_test", testFiles: [] };
    const r = computePrdLifecycleHealth(makeDoc([epic, noTest]), "epic_1");
    expect(r.phases.IMPLEMENT.passed).toBe(false);
    expect(r.phases.IMPLEMENT.value).toBe(0);
  });

  it("DEPLOY phase fails when harness grade < B", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      harnessGrade: "C",
    });
    expect(r.phases.DEPLOY.passed).toBe(false);
    expect(r.phases.DEPLOY.value).toBe("C");
  });

  it("LISTENING fails when decision closure rate < 1.0", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      decisionOutcomeClosureRate: 0.5,
    });
    expect(r.phases.LISTENING.passed).toBe(false);
    expect(r.phases.LISTENING.value).toBe(0.5);
    expect(r.phases.LISTENING.reason).toContain("50%");
  });

  it("PLAN fails when capacity delta exceeds ±10%", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      capacityCalibrationDelta: 0.25,
    });
    expect(r.phases.PLAN.passed).toBe(false);
  });

  it("REVIEW fails when blast radius exceeds 5 files", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      blastRadiusFiles: 12,
    });
    expect(r.phases.REVIEW.passed).toBe(false);
    expect(r.phases.REVIEW.value).toBe(12);
  });

  it("summary lists failing phases when not all passed", () => {
    const r = computePrdLifecycleHealth(makeDoc([epic, goodTask]), "epic_1", {
      harnessGrade: "D",
      decisionOutcomeClosureRate: 0.5,
    });
    expect(r.summary).toContain("DEPLOY");
    expect(r.summary).toContain("LISTENING");
  });
});
