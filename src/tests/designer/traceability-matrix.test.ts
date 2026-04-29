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

import { describe, it, expect } from "vitest";
import { buildTraceabilityMatrix } from "../../core/designer/traceability-matrix.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Node ${i}`,
    status: n.status ?? "backlog",
    priority: n.priority ?? 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...n,
  })) as GraphNode[];

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge_${i}`,
    from: e.from ?? "",
    to: e.to ?? "",
    relationType: e.relationType ?? "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
    ...e,
  })) as GraphEdge[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: fullEdges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("buildTraceabilityMatrix", () => {
  it("should return empty report when no requirement nodes", () => {
    const doc = makeDoc([{ type: "epic" }, { type: "decision" }]);
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix).toHaveLength(0);
    // With orphan decision, coverage is less than 100%
    expect(report.coverageRate).toBe(0);
    expect(report.uncoveredRequirements).toHaveLength(0);
    expect(report.orphanDecisions).toHaveLength(1);
  });

  it("should mark requirement as 'none' when no linked decisions or constraints", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement" },
      { id: "dec1", type: "decision" },
    ]);
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix).toHaveLength(1);
    expect(report.matrix[0].coverage).toBe("none");
    expect(report.uncoveredRequirements).toContain("req1");
    expect(report.coverageRate).toBe(0);
  });

  it("should mark requirement as 'full' when linked to both decision and constraint", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].coverage).toBe("full");
    expect(report.matrix[0].linkedDecisions).toContain("dec1");
    expect(report.matrix[0].linkedConstraints).toContain("con1");
    expect(report.coverageRate).toBe(100);
  });

  it("should mark requirement as 'partial' when linked to decision but not constraint", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "derived_from" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].coverage).toBe("partial");
  });

  it("should detect orphan decisions not linked to any requirement", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "dec2", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.orphanDecisions).toContain("dec2");
    expect(report.orphanDecisions).not.toContain("dec1");
  });

  it("should follow edges in both directions", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "dec1", to: "req1", relationType: "implements" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].linkedDecisions).toContain("dec1");
  });

  it("should follow parent_of/child_of edges for traceability", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "parent_of" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.matrix[0].linkedDecisions).toContain("dec1");
  });

  it("should calculate correct coverage rate with mixed statuses", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "req2", type: "requirement" },
        { id: "req3", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "con1", type: "constraint" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "req1", to: "con1", relationType: "related_to" },
        { from: "req2", to: "dec1", relationType: "derived_from" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    // req1=full, req2=partial, req3=none, dec1=linked
    // totalItems = 3 reqs + 1 dec = 4, linkedItems = 2 covered reqs + 1 linked dec = 3
    // coverageRate = 3/4 = 75%
    expect(report.coverageRate).toBe(75);
    expect(report.uncoveredRequirements).toContain("req3");
  });

  it("should handle graph with no edges", () => {
    const doc = makeDoc([
      { id: "req1", type: "requirement" },
      { id: "req2", type: "requirement" },
      { id: "dec1", type: "decision" },
    ]);
    const report = buildTraceabilityMatrix(doc);
    expect(report.coverageRate).toBe(0);
    expect(report.uncoveredRequirements).toHaveLength(2);
    expect(report.orphanDecisions).toHaveLength(1);
  });

  it("should NOT count decision linked to epic as orphan", () => {
    const doc = makeDoc(
      [
        { id: "epic1", type: "epic" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "dec1", to: "epic1", relationType: "related_to" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.orphanDecisions).not.toContain("dec1");
    expect(report.orphanDecisions).toHaveLength(0);
  });

  it("should NOT count decision linked to requirement as orphan", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.orphanDecisions).not.toContain("dec1");
    expect(report.orphanDecisions).toHaveLength(0);
  });

  it("should count decision with no links as orphan", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "dec2", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    expect(report.orphanDecisions).toContain("dec2");
    expect(report.orphanDecisions).toHaveLength(1);
  });

  it("should not decrease coverageRate when adding decision linked to epic", () => {
    // Baseline: 1 req + 1 dec linked to req = 100%
    const baseDoc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
      ],
    );
    const baseReport = buildTraceabilityMatrix(baseDoc);

    // Add a new decision linked to an epic — should NOT decrease coverage
    const extDoc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "dec1", type: "decision" },
        { id: "dec2", type: "decision" },
        { id: "epic1", type: "epic" },
      ],
      [
        { from: "req1", to: "dec1", relationType: "implements" },
        { from: "dec2", to: "epic1", relationType: "related_to" },
      ],
    );
    const extReport = buildTraceabilityMatrix(extDoc);

    expect(extReport.coverageRate).toBeGreaterThanOrEqual(baseReport.coverageRate);
    expect(extReport.orphanDecisions).not.toContain("dec2");
  });

  it("should not count non-traceability edge types for coverage", () => {
    const doc = makeDoc(
      [
        { id: "req1", type: "requirement" },
        { id: "task1", type: "task" },
      ],
      [
        { from: "req1", to: "task1", relationType: "depends_on" },
      ],
    );
    const report = buildTraceabilityMatrix(doc);
    // depends_on to a task, not a decision/constraint — still "none" for traceability
    expect(report.matrix[0].coverage).toBe("none");
  });
});
