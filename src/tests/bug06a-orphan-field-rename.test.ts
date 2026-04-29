/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * BUG-06-A — rename orphan fields for semantic clarity.
 *
 * AC1: analyze(scope) output field is orphanRequirementsCount (number)
 * AC2: analyze(traceability) output field is untracedRequirements (array)
 * AC3: requirements without decision edges → output.traceabilityWarning > 0
 */

import { describe, it, expect } from "vitest";
import { analyzeScope } from "../core/analyzer/scope-analyzer.js";
import { buildTraceabilityMatrix } from "../core/designer/traceability-matrix.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import type { NodeType } from "../core/graph/graph-types.js";

const PROJECT = {
  id: "proj_test",
  name: "test",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const INDEXES = { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} };

function makeDoc(nodes: GraphNode[] = [], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0",
    project: PROJECT,
    nodes,
    edges,
    indexes: INDEXES,
    meta: { sourceFiles: [], lastImport: null },
  };
}

let _counter = 0;
function makeNode(type: NodeType, id?: string): GraphNode {
  const nodeId = id ?? `node_${++_counter}`;
  return {
    id: nodeId,
    type,
    title: `Node ${nodeId}`,
    status: "backlog",
    priority: 3,
    blocked: false,
    acceptanceCriteria: [],
    tags: [],
    metadata: {},
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

function makeEdge(from: string, to: string): GraphEdge {
  return {
    id: `edge_${++_counter}`,
    from,
    to,
    relationType: "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
  };
}

// ── AC1: scope output uses orphanRequirementsCount ────────────────────────

describe("analyzeScope — orphanRequirementsCount field", () => {
  it("AC1: output has orphanRequirementsCount (number), not orphanRequirements", () => {
    const doc = makeDoc([makeNode("task")]);
    const result = analyzeScope(doc);

    expect(result.coverage).toHaveProperty("orphanRequirementsCount");
    expect(typeof result.coverage.orphanRequirementsCount).toBe("number");
    expect(result.coverage).not.toHaveProperty("orphanRequirements");
  });

  it("AC1: orphanRequirementsCount is 0 when no orphan requirement nodes exist", () => {
    const doc = makeDoc([makeNode("task")]);
    const result = analyzeScope(doc);

    expect(result.coverage.orphanRequirementsCount).toBe(0);
  });

  it("AC1: orphanRequirementsCount counts requirement-type orphan nodes", () => {
    const req = makeNode("requirement"); // no parent → orphan
    const doc = makeDoc([req]);
    const result = analyzeScope(doc);

    expect(result.coverage.orphanRequirementsCount).toBeGreaterThan(0);
  });
});

// ── AC2: traceability output uses untracedRequirements ───────────────────

describe("buildTraceabilityMatrix — untracedRequirements field", () => {
  it("AC2: output has untracedRequirements (array), not orphanRequirements", () => {
    const doc = makeDoc([makeNode("requirement", "req1")]);
    const result = buildTraceabilityMatrix(doc);

    expect(result).toHaveProperty("untracedRequirements");
    expect(Array.isArray(result.untracedRequirements)).toBe(true);
    expect(result).not.toHaveProperty("orphanRequirements");
  });

  it("AC2: untracedRequirements contains IDs of requirements with no decision/constraint edge", () => {
    const doc = makeDoc([makeNode("requirement", "req1")]);
    const result = buildTraceabilityMatrix(doc);

    expect(result.untracedRequirements).toContain("req1");
  });

  it("AC2: untracedRequirements is empty when all requirements are linked to a decision", () => {
    const req = makeNode("requirement", "req1");
    const dec = makeNode("decision", "dec1");
    const doc = makeDoc([req, dec], [makeEdge("req1", "dec1")]);
    const result = buildTraceabilityMatrix(doc);

    expect(result.untracedRequirements).not.toContain("req1");
  });
});

// ── AC3: traceabilityWarning in scope when requirements lack decision edges ─

describe("analyzeScope — traceabilityWarning field", () => {
  it("AC3: traceabilityWarning is a number when orphan requirements exist", () => {
    const req = makeNode("requirement"); // no decision edge
    const doc = makeDoc([req]);
    const result = analyzeScope(doc);

    expect(result.coverage).toHaveProperty("traceabilityWarning");
    expect(typeof result.coverage.traceabilityWarning).toBe("number");
    expect(result.coverage.traceabilityWarning).toBeGreaterThan(0);
  });

  it("AC3: traceabilityWarning is 0 when all requirements have decision edges", () => {
    const req = makeNode("requirement", "req1");
    const dec = makeNode("decision", "dec1");
    const doc = makeDoc([req, dec], [makeEdge("req1", "dec1")]);
    const result = analyzeScope(doc);

    expect(result.coverage.traceabilityWarning).toBe(0);
  });
});
