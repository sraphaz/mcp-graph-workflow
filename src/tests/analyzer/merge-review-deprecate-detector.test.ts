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
import { detectMrdCandidates } from "../../core/analyzer/merge-review-deprecate-detector.js";
import type { ReviewCandidate, DeprecateCandidate } from "../../core/analyzer/merge-review-deprecate-detector.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

const NOW = new Date().toISOString();
const STALE_DATE = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
const OLD_INPROGRESS = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days ago

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
    createdAt: n.createdAt ?? NOW,
    updatedAt: n.updatedAt ?? NOW,
    ...n,
  })) as GraphNode[];

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge_${i}`,
    from: e.from ?? "",
    to: e.to ?? "",
    relationType: e.relationType ?? "depends_on",
    createdAt: NOW,
    ...e,
  })) as GraphEdge[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: NOW, updatedAt: NOW },
    nodes: fullNodes,
    edges: fullEdges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("detectMrdCandidates", () => {
  describe("empty / clean graph", () => {
    it("should return empty report for empty graph", () => {
      const report = detectMrdCandidates(makeDoc());
      expect(report.merge).toHaveLength(0);
      expect(report.review).toHaveLength(0);
      expect(report.deprecate).toHaveLength(0);
    });

    it("should return empty report for single clean node", () => {
      const doc = makeDoc([{
        id: "a",
        title: "Implement auth flow",
        status: "backlog",
        priority: 3,
        parentId: "epic_1",
        acceptanceCriteria: ["Auth returns JWT on success"],
      }]);
      const report = detectMrdCandidates(doc);
      expect(report.merge).toHaveLength(0);
      expect(report.review).toHaveLength(0);
      expect(report.deprecate).toHaveLength(0);
    });
  });

  describe("merge candidates — title similarity", () => {
    it("should detect near-duplicate titles (Jaccard >= 0.7)", () => {
      const doc = makeDoc([
        { id: "a", title: "Implement user authentication flow", type: "task", status: "backlog" },
        { id: "b", title: "Implement authentication user flow", type: "task", status: "backlog" },
      ]);
      const report = detectMrdCandidates(doc);
      expect(report.merge.length).toBeGreaterThanOrEqual(1);
      const pair = report.merge[0];
      expect([pair.nodeA, pair.nodeB]).toContain("a");
      expect([pair.nodeA, pair.nodeB]).toContain("b");
      expect(pair.similarity).toBeGreaterThanOrEqual(0.7);
    });

    it("should not flag distinct titles (Jaccard < 0.7)", () => {
      const doc = makeDoc([
        { id: "a", title: "Implement user login", type: "task", status: "backlog" },
        { id: "b", title: "Deploy database migration script", type: "task", status: "backlog" },
      ]);
      expect(detectMrdCandidates(doc).merge).toHaveLength(0);
    });

    it("should not flag done nodes as merge candidates", () => {
      const doc = makeDoc([
        { id: "a", title: "Implement authentication flow user", type: "task", status: "done" },
        { id: "b", title: "Implement user authentication flow", type: "task", status: "done" },
      ]);
      expect(detectMrdCandidates(doc).merge).toHaveLength(0);
    });

    it("should include sameParent=true when both nodes share parentId", () => {
      const doc = makeDoc([
        { id: "a", title: "Setup database connection pool", type: "task", status: "backlog", parentId: "epic_1" },
        { id: "b", title: "Setup connection pool database", type: "task", status: "backlog", parentId: "epic_1" },
      ]);
      const report = detectMrdCandidates(doc);
      expect(report.merge.length).toBeGreaterThanOrEqual(1);
      expect(report.merge[0].sameParent).toBe(true);
    });

    it("should report sameParent=false when nodes have different parents", () => {
      const doc = makeDoc([
        { id: "a", title: "Setup database connection pool", type: "task", status: "backlog", parentId: "epic_1" },
        { id: "b", title: "Setup connection pool database", type: "task", status: "backlog", parentId: "epic_2" },
      ]);
      const report = detectMrdCandidates(doc);
      if (report.merge.length > 0) {
        expect(report.merge[0].sameParent).toBe(false);
      }
    });
  });

  describe("review candidates", () => {
    it("should flag in_progress task stale for >7 days", () => {
      const doc = makeDoc([
        { id: "a", title: "Refactor auth module", status: "in_progress", updatedAt: OLD_INPROGRESS },
      ]);
      const report = detectMrdCandidates(doc);
      const issue = report.review.find((r: ReviewCandidate) => r.nodeId === "a" && r.reason === "stale_in_progress");
      expect(issue).toBeDefined();
    });

    it("should not flag in_progress task updated recently", () => {
      const doc = makeDoc([
        { id: "a", title: "Refactor auth module", status: "in_progress", updatedAt: RECENT_DATE },
      ]);
      const report = detectMrdCandidates(doc);
      expect(report.review.filter((r: ReviewCandidate) => r.nodeId === "a" && r.reason === "stale_in_progress")).toHaveLength(0);
    });

    it("should flag high-priority task (priority 1-2) stale in backlog >30 days", () => {
      const doc = makeDoc([
        { id: "a", title: "Critical security fix", status: "backlog", priority: 1, createdAt: STALE_DATE },
      ]);
      const report = detectMrdCandidates(doc);
      const issue = report.review.find((r: ReviewCandidate) => r.nodeId === "a" && r.reason === "high_priority_stale");
      expect(issue).toBeDefined();
    });

    it("should not flag priority 3+ tasks as high_priority_stale", () => {
      const doc = makeDoc([
        { id: "a", title: "Nice to have feature", status: "backlog", priority: 3, createdAt: STALE_DATE },
      ]);
      expect(detectMrdCandidates(doc).review.filter((r: ReviewCandidate) => r.reason === "high_priority_stale")).toHaveLength(0);
    });

    it("should flag task/subtask with no acceptanceCriteria as missing_ac_critical", () => {
      const doc = makeDoc([
        { id: "a", title: "Implement payment gateway", type: "task", status: "backlog", acceptanceCriteria: [] },
        { id: "b", title: "Add retry logic", type: "subtask", status: "backlog" },
      ]);
      const report = detectMrdCandidates(doc);
      expect(report.review.filter((r: ReviewCandidate) => r.reason === "missing_ac_critical").map((r: ReviewCandidate) => r.nodeId)).toContain("a");
      expect(report.review.filter((r: ReviewCandidate) => r.reason === "missing_ac_critical").map((r: ReviewCandidate) => r.nodeId)).toContain("b");
    });

    it("should not flag epics for missing_ac_critical", () => {
      const doc = makeDoc([
        { id: "a", title: "Big epic no ac", type: "epic", status: "backlog" },
      ]);
      expect(detectMrdCandidates(doc).review.filter((r: ReviewCandidate) => r.reason === "missing_ac_critical")).toHaveLength(0);
    });

    it("should flag blocked node whose blocker is done", () => {
      const doc = makeDoc(
        [
          { id: "a", title: "Task blocked", status: "blocked", blocked: true },
          { id: "b", title: "Blocker done", status: "done" },
        ],
        [{ id: "e1", from: "a", to: "b", relationType: "depends_on" }],
      );
      const report = detectMrdCandidates(doc);
      const issue = report.review.find((r: ReviewCandidate) => r.nodeId === "a" && r.reason === "blocked_by_done");
      expect(issue).toBeDefined();
    });

    it("should not flag blocked node whose blocker is still active", () => {
      const doc = makeDoc(
        [
          { id: "a", title: "Task blocked", status: "blocked", blocked: true },
          { id: "b", title: "Blocker active", status: "in_progress" },
        ],
        [{ id: "e1", from: "a", to: "b", relationType: "depends_on" }],
      );
      expect(detectMrdCandidates(doc).review.filter((r: ReviewCandidate) => r.reason === "blocked_by_done")).toHaveLength(0);
    });
  });

  describe("deprecate candidates", () => {
    it("should flag node tagged 'deprecated'", () => {
      const doc = makeDoc([
        { id: "a", title: "Old API endpoint", tags: ["deprecated"], status: "backlog" },
      ]);
      const report = detectMrdCandidates(doc);
      const issue = report.deprecate.find((d: DeprecateCandidate) => d.nodeId === "a" && d.reason === "tagged_deprecated");
      expect(issue).toBeDefined();
    });

    it("should flag node tagged 'obsolete'", () => {
      const doc = makeDoc([
        { id: "a", title: "Legacy module", tags: ["obsolete"], status: "backlog" },
      ]);
      expect(detectMrdCandidates(doc).deprecate.find((d: DeprecateCandidate) => d.reason === "tagged_deprecated")).toBeDefined();
    });

    it("should flag orphan node (no parentId, no edges, not done)", () => {
      const doc = makeDoc([
        { id: "a", title: "Floating task", status: "backlog", parentId: undefined },
        { id: "b", title: "Connected task", status: "backlog", parentId: "epic_x" },
      ]);
      const report = detectMrdCandidates(doc);
      expect(report.deprecate.find((d: DeprecateCandidate) => d.nodeId === "a" && d.reason === "orphan_no_edges")).toBeDefined();
      expect(report.deprecate.find((d: DeprecateCandidate) => d.nodeId === "b")).toBeUndefined();
    });

    it("should not flag orphan node that is done", () => {
      const doc = makeDoc([
        { id: "a", title: "Completed standalone", status: "done", parentId: undefined },
      ]);
      expect(detectMrdCandidates(doc).deprecate.filter((d: DeprecateCandidate) => d.reason === "orphan_no_edges")).toHaveLength(0);
    });
  });

  describe("report summary", () => {
    it("should include totalCandidates count", () => {
      const doc = makeDoc([
        { id: "a", title: "Old API endpoint", tags: ["deprecated"] },
      ]);
      const report = detectMrdCandidates(doc);
      expect(typeof report.totalCandidates).toBe("number");
      expect(report.totalCandidates).toBeGreaterThanOrEqual(1);
    });

    it("totalCandidates equals sum of all candidate arrays", () => {
      const doc = makeDoc([
        { id: "a", title: "Stale critical task", status: "backlog", priority: 1, createdAt: STALE_DATE },
        { id: "b", title: "Tagged deprecated", tags: ["deprecated"] },
      ]);
      const report = detectMrdCandidates(doc);
      const expected = report.merge.length + report.review.length + report.deprecate.length;
      expect(report.totalCandidates).toBe(expected);
    });
  });
});
