/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §BUG-06 — analyze(scope) and analyze(traceability) used the same field
 * name "orphanRequirements" for two different concepts. Scope counts
 * structural orphans (no parent edge); Traceability counts uncovered
 * requirements (no linked decision/constraint). Fix: traceability now
 * exposes `uncoveredRequirements` as the canonical name; the legacy
 * `orphanRequirements` field is kept as an alias for back-compat.
 */

import { describe, it, expect } from "vitest";
import { buildTraceabilityMatrix } from "../core/designer/traceability-matrix.js";
import { analyzeScope } from "../core/analyzer/scope-analyzer.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function node(id: string, type: GraphNode["type"], parentId?: string): GraphNode {
  return {
    id,
    type,
    title: id,
    status: "backlog",
    priority: 3,
    parentId,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  } as GraphNode;
}

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "p", name: "t", createdAt: "x", updatedAt: "x" },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("BUG-06 — orphan definition consistency", () => {
  it("traceability exposes uncoveredRequirements as canonical name", () => {
    const doc = makeDoc([
      node("epic-1", "epic"),
      node("req-1", "requirement", "epic-1"), // has parent, no ADR linked → uncovered
    ]);
    const report = buildTraceabilityMatrix(doc);
    expect(report).toHaveProperty("uncoveredRequirements");
    expect(report.uncoveredRequirements).toContain("req-1");
  });

  it("scope orphanRequirements = requirements without linked tasks/edges (different from traceability uncovered)", () => {
    // A requirement with a linked task is NOT a scope orphan, even with no decision linkage.
    const doc = makeDoc(
      [
        node("epic-1", "epic"),
        node("req-with-task", "requirement", "epic-1"),
        node("task-1", "task", "req-with-task"),
        node("req-no-task", "requirement", "epic-1"),
      ],
    );
    const scope = analyzeScope(doc);
    // req-with-task has a child task → not a scope orphan
    // req-no-task has no child task and no edge → IS a scope orphan
    const orphanIds = scope.orphans.map((o) => o.id);
    expect(orphanIds).not.toContain("req-with-task");
    expect(orphanIds).toContain("req-no-task");
  });

  it("the two analyses use different concepts (BUG-06 fix: distinct field names)", () => {
    // req-1 has a child task (NOT scope-orphan) but no linked decision (IS traceability-uncovered).
    // Note: REQUIREMENT_TYPES includes "epic", so omitting an epic keeps the test deterministic.
    const doc = makeDoc(
      [
        node("req-1", "requirement"),
        node("task-1", "task", "req-1"),
      ],
    );
    const scope = analyzeScope(doc);
    const trace = buildTraceabilityMatrix(doc);
    // req-1 is NOT a scope orphan (has child task)
    expect(scope.coverage.orphanRequirementsCount).toBe(0);
    // req-1 IS a traceability uncovered (no linked decision/constraint)
    expect(trace.uncoveredRequirements).toContain("req-1");
  });
});
