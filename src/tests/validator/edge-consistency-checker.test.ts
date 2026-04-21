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
import { checkEdgeConsistency } from "../../core/validator/edge-consistency-checker.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Task ${i}`,
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

describe("checkEdgeConsistency", () => {
  describe("empty graph", () => {
    it("should pass on empty graph", () => {
      const report = checkEdgeConsistency(makeDoc());
      expect(report.passed).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it("should pass when edges are consistent", () => {
      const doc = makeDoc(
        [{ id: "a" }, { id: "b" }],
        [{ id: "e1", from: "a", to: "b", relationType: "depends_on" }],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });
  });

  describe("self_loop detection", () => {
    it("should detect self-referential edge", () => {
      const doc = makeDoc(
        [{ id: "a" }],
        [{ id: "e1", from: "a", to: "a", relationType: "depends_on" }],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.passed).toBe(false);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].issueType).toBe("self_loop");
      expect(report.issues[0].edgeId).toBe("e1");
    });
  });

  describe("redundant_inverse detection", () => {
    it("should detect depends_on A→B with blocks B→A (semantic duplicate)", () => {
      const doc = makeDoc(
        [{ id: "a" }, { id: "b" }],
        [
          { id: "e1", from: "a", to: "b", relationType: "depends_on" },
          { id: "e2", from: "b", to: "a", relationType: "blocks" },
        ],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.passed).toBe(false);
      const issue = report.issues.find(i => i.issueType === "redundant_inverse");
      expect(issue).toBeDefined();
      expect(issue!.involvedNodes).toContain("a");
      expect(issue!.involvedNodes).toContain("b");
    });

    it("should not flag depends_on A→B with blocks A→B (different semantic)", () => {
      const doc = makeDoc(
        [{ id: "a" }, { id: "b" }],
        [
          { id: "e1", from: "a", to: "b", relationType: "depends_on" },
          { id: "e2", from: "a", to: "b", relationType: "blocks" },
        ],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.issues.filter(i => i.issueType === "redundant_inverse")).toHaveLength(0);
    });

    it("should not flag depends_on when no blocks edge exists", () => {
      const doc = makeDoc(
        [{ id: "a" }, { id: "b" }],
        [{ id: "e1", from: "a", to: "b", relationType: "depends_on" }],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });
  });

  describe("parent_child pair integrity", () => {
    it("should detect parent_of without matching child_of", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c" }],
        [{ id: "e1", from: "p", to: "c", relationType: "parent_of" }],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.passed).toBe(false);
      const issue = report.issues.find(i => i.issueType === "orphan_parent_of");
      expect(issue).toBeDefined();
      expect(issue!.edgeId).toBe("e1");
    });

    it("should detect child_of without matching parent_of", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c" }],
        [{ id: "e1", from: "c", to: "p", relationType: "child_of" }],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.passed).toBe(false);
      const issue = report.issues.find(i => i.issueType === "orphan_child_of");
      expect(issue).toBeDefined();
      expect(issue!.edgeId).toBe("e1");
    });

    it("should pass when parent_of and child_of form a consistent pair", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c" }],
        [
          { id: "e1", from: "p", to: "c", relationType: "parent_of" },
          { id: "e2", from: "c", to: "p", relationType: "child_of" },
        ],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });

    it("should detect parent_of where child node parentId contradicts edge", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c", parentId: "other" }],
        [
          { id: "e1", from: "p", to: "c", relationType: "parent_of" },
          { id: "e2", from: "c", to: "p", relationType: "child_of" },
        ],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.passed).toBe(false);
      const issue = report.issues.find(i => i.issueType === "parent_child_mismatch");
      expect(issue).toBeDefined();
      expect(issue!.involvedNodes).toContain("c");
    });

    it("should not flag parent_child_mismatch when parentId matches", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c", parentId: "p" }],
        [
          { id: "e1", from: "p", to: "c", relationType: "parent_of" },
          { id: "e2", from: "c", to: "p", relationType: "child_of" },
        ],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });

    it("should not flag parent_child_mismatch when parentId is null", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c", parentId: null }],
        [
          { id: "e1", from: "p", to: "c", relationType: "parent_of" },
          { id: "e2", from: "c", to: "p", relationType: "child_of" },
        ],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });

    it("should not flag parent_child_mismatch when parentId is undefined", () => {
      const doc = makeDoc(
        [{ id: "p" }, { id: "c" }],
        [
          { id: "e1", from: "p", to: "c", relationType: "parent_of" },
          { id: "e2", from: "c", to: "p", relationType: "child_of" },
        ],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });
  });

  describe("multiple issues", () => {
    it("should collect all issues in a single pass", () => {
      const doc = makeDoc(
        [{ id: "a" }, { id: "b" }, { id: "s" }],
        [
          { id: "e1", from: "a", to: "b", relationType: "depends_on" },
          { id: "e2", from: "b", to: "a", relationType: "blocks" },
          { id: "e3", from: "s", to: "s", relationType: "related_to" },
        ],
      );
      const report = checkEdgeConsistency(doc);
      expect(report.passed).toBe(false);
      expect(report.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("unrelated edges pass through unchanged", () => {
    it("should pass for related_to, implements, derived_from edges", () => {
      const doc = makeDoc(
        [{ id: "a" }, { id: "b" }, { id: "c" }],
        [
          { id: "e1", from: "a", to: "b", relationType: "related_to" },
          { id: "e2", from: "a", to: "c", relationType: "implements" },
          { id: "e3", from: "b", to: "c", relationType: "derived_from" },
        ],
      );
      expect(checkEdgeConsistency(doc).passed).toBe(true);
    });
  });
});
