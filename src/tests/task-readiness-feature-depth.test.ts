/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { computeTaskReadinessScore } from "../core/planner/task-readiness-score.js";
import { makeNode } from "./helpers/factories.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

function makeDoc(): GraphDocument {
  return {
    version: "1.0.0",
    project: {
      id: "p",
      name: "P",
      createdAt: "2026-04-26T00:00:00Z",
      updatedAt: "2026-04-26T00:00:00Z",
    },
    meta: { sourceFiles: [], lastImport: null },
    nodes: [],
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
  };
}

describe("computeTaskReadinessScore — featureDepth signal", () => {
  it("featureDepth.bonus is 0 when score is undefined (back-compat)", () => {
    const node = makeNode({
      type: "task",
      title: "x",
      acceptanceCriteria: ["Given X\nWhen Y\nThen Z"],
    });
    const r = computeTaskReadinessScore(node, makeDoc());
    expect(r.signals.featureDepth.score).toBeNull();
    expect(r.signals.featureDepth.bonus).toBe(0);
  });

  it("featureDepth.bonus is 0 when score is mature (≥50)", () => {
    const node = makeNode({
      type: "task",
      title: "x",
      acceptanceCriteria: ["Given X\nWhen Y\nThen Z"],
    });
    const r = computeTaskReadinessScore(node, makeDoc(), {
      featureDepthScore: 75,
    });
    expect(r.signals.featureDepth.score).toBe(75);
    expect(r.signals.featureDepth.bonus).toBe(0);
  });

  it("featureDepth.bonus surfaces fragile files (low score → positive bonus)", () => {
    const node = makeNode({
      type: "task",
      title: "x",
      acceptanceCriteria: ["Given X\nWhen Y\nThen Z"],
    });
    const r = computeTaskReadinessScore(node, makeDoc(), {
      featureDepthScore: 20,
    });
    expect(r.signals.featureDepth.bonus).toBeGreaterThan(0);
  });

  it("bonus is capped at +10", () => {
    const node = makeNode({
      type: "task",
      title: "x",
      acceptanceCriteria: ["Given X\nWhen Y\nThen Z"],
    });
    const r = computeTaskReadinessScore(node, makeDoc(), {
      featureDepthScore: 0,
    });
    expect(r.signals.featureDepth.bonus).toBeLessThanOrEqual(10);
  });

  it("score moves up when a fragile file is touched (vs. same task without signal)", () => {
    const node = makeNode({
      type: "task",
      title: "x",
      acceptanceCriteria: ["Given X\nWhen Y\nThen Z"],
    });
    const baseline = computeTaskReadinessScore(node, makeDoc());
    const fragile = computeTaskReadinessScore(node, makeDoc(), {
      featureDepthScore: 15,
    });
    expect(fragile.score).toBeGreaterThan(baseline.score);
  });

  it("rationale mentions fragile-file bonus when active", () => {
    const node = makeNode({
      type: "task",
      title: "x",
      acceptanceCriteria: ["Given X\nWhen Y\nThen Z"],
    });
    const r = computeTaskReadinessScore(node, makeDoc(), {
      featureDepthScore: 15,
    });
    expect(r.rationale.some((line) => line.includes("fragile-file bonus"))).toBe(true);
  });
});
