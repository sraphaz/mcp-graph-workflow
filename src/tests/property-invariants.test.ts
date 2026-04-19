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

/**
 * Property-Based Invariant Tests
 *
 * Tests graph-state invariants: referential integrity, status monotonicity,
 * DAG acyclicity. These run inside finish_task pipeline to catch violations.
 */

import { describe, it, expect } from "vitest";
import { makeNode, makeEdge } from "./helpers/factories.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import {
  checkInvariants,
  getBuiltInInvariants,
  type PropertyInvariant,
  type InvariantViolation,
} from "../core/harness/property-invariants.js";

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "test", name: "Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("property-invariants", () => {
  describe("checkInvariants", () => {
    it("should return passed=true for a clean graph", () => {
      const a = makeNode({ title: "A", status: "in_progress" });
      const b = makeNode({ title: "B", status: "backlog" });
      const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);

      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.checkedInvariants).toBe(3);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty graph gracefully", () => {
      const doc = makeDoc([], []);
      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("referentialIntegrity", () => {
    it("should detect edge referencing nonexistent 'to' node", () => {
      const a = makeNode({ title: "A" });
      const edge = makeEdge(a.id, "nonexistent-node-id");
      const doc = makeDoc([a], [edge]);

      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(false);
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "referential_integrity");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].edgeId).toBe(edge.id);
      expect(violations[0].severity).toBe("error");
      expect(violations[0].message).toContain("nonexistent-node-id");
    });

    it("should detect edge referencing nonexistent 'from' node", () => {
      const b = makeNode({ title: "B" });
      const edge = makeEdge("nonexistent-from", b.id);
      const doc = makeDoc([b], [edge]);

      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(false);
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "referential_integrity");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].severity).toBe("error");
    });

    it("should detect both from and to nonexistent in same edge", () => {
      const edge = makeEdge("ghost-a", "ghost-b");
      const doc = makeDoc([], [edge]);

      const result = checkInvariants(doc, getBuiltInInvariants());

      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "referential_integrity");
      expect(violations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("statusMonotonicity", () => {
    it("should detect a node with previousStatus=done but current status is not done", () => {
      const a = makeNode({
        title: "Regressed task",
        status: "in_progress",
        metadata: { previousStatus: "done" },
      });
      const doc = makeDoc([a]);

      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(false);
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "status_monotonicity");
      expect(violations).toHaveLength(1);
      expect(violations[0].nodeId).toBe(a.id);
      expect(violations[0].severity).toBe("warning");
      expect(violations[0].message).toContain("done");
    });

    it("should pass when node was never done", () => {
      const a = makeNode({
        title: "Normal task",
        status: "in_progress",
        metadata: { previousStatus: "backlog" },
      });
      const doc = makeDoc([a]);

      const result = checkInvariants(doc, getBuiltInInvariants());
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "status_monotonicity");
      expect(violations).toHaveLength(0);
    });

    it("should pass when node is still done", () => {
      const a = makeNode({
        title: "Done task",
        status: "done",
        metadata: { previousStatus: "done" },
      });
      const doc = makeDoc([a]);

      const result = checkInvariants(doc, getBuiltInInvariants());
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "status_monotonicity");
      expect(violations).toHaveLength(0);
    });
  });

  describe("dagAcyclicity", () => {
    it("should detect a simple cycle A→B→A", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      const doc = makeDoc(
        [a, b],
        [makeEdge(a.id, b.id), makeEdge(b.id, a.id)],
      );

      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(false);
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "dag_acyclicity");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].severity).toBe("error");
      expect(violations[0].message).toContain("cycle");
    });

    it("should detect a 3-node cycle A→B→C→A", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      const c = makeNode({ title: "C" });
      const doc = makeDoc(
        [a, b, c],
        [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(c.id, a.id)],
      );

      const result = checkInvariants(doc, getBuiltInInvariants());

      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "dag_acyclicity");
      expect(violations.length).toBeGreaterThanOrEqual(1);
    });

    it("should pass for a valid DAG", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      const c = makeNode({ title: "C" });
      const doc = makeDoc(
        [a, b, c],
        [makeEdge(a.id, b.id), makeEdge(a.id, c.id)],
      );

      const result = checkInvariants(doc, getBuiltInInvariants());
      const violations = result.violations.filter((v: InvariantViolation) => v.invariantId === "dag_acyclicity");
      expect(violations).toHaveLength(0);
    });
  });

  describe("mixed violations", () => {
    it("should collect all violations from multiple invariants", () => {
      const a = makeNode({
        title: "Regressed",
        status: "backlog",
        metadata: { previousStatus: "done" },
      });
      const b = makeNode({ title: "B" });
      const doc = makeDoc(
        [a, b],
        [
          makeEdge(a.id, "ghost"),
          makeEdge(a.id, b.id),
          makeEdge(b.id, a.id),
        ],
      );

      const result = checkInvariants(doc, getBuiltInInvariants());

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);

      const invariantIds = new Set(result.violations.map((v: InvariantViolation) => v.invariantId));
      expect(invariantIds.has("referential_integrity")).toBe(true);
      expect(invariantIds.has("status_monotonicity")).toBe(true);
    });
  });

  describe("custom invariants", () => {
    it("should accept and run custom invariants alongside built-in ones", () => {
      const custom: PropertyInvariant = {
        id: "custom_check",
        name: "Custom Check",
        description: "Always finds a violation for testing",
        severity: "warning",
        check: () => [
          {
            invariantId: "custom_check",
            message: "Custom violation",
            severity: "warning",
          },
        ],
      };

      const doc = makeDoc([makeNode({ title: "X" })]);
      const result = checkInvariants(doc, [custom]);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].invariantId).toBe("custom_check");
    });
  });
});
