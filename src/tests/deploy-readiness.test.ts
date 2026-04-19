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
import { checkDeployReadiness } from "../core/deployer/deploy-readiness.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

function makeDoc(overrides: Partial<GraphDocument> = {}): GraphDocument {
  return {
    projectId: "test-proj",
    nodes: [],
    edges: [],
    ...overrides,
  } as GraphDocument;
}

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    id: `node-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Task",
    type: "task",
    status: "done",
    priority: 3,
    blocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Deploy Readiness", () => {
  it("should return ready=true when all tasks are done with no cycles", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
        makeNode({ id: "t2", status: "done" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true });

    expect(result.ready).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.grade).toBeDefined();
  });

  it("should return ready=false when tasks are not all done", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
        makeNode({ id: "t2", status: "in_progress" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true });

    expect(result.ready).toBe(false);
    expect(result.summary).toContain("Not Ready");
  });

  it("should return ready=false when blocked nodes exist", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "blocked" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true });

    expect(result.ready).toBe(false);
    const blockedCheck = result.checks.find((c) => c.name === "no_blocked_nodes");
    expect(blockedCheck?.passed).toBe(false);
  });

  it("should return ready=false when no snapshot exists", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: false });

    expect(result.ready).toBe(false);
    const snapshotCheck = result.checks.find((c) => c.name === "has_snapshot");
    expect(snapshotCheck?.passed).toBe(false);
  });

  it("should detect dependency cycles", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
        makeNode({ id: "t2", status: "done" }),
      ] as GraphDocument["nodes"],
      edges: [
        { id: "e1", from: "t1", to: "t2", relationType: "depends_on" },
        { id: "e2", from: "t2", to: "t1", relationType: "depends_on" },
      ] as GraphDocument["edges"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true });

    const cycleCheck = result.checks.find((c) => c.name === "no_cycles");
    expect(cycleCheck?.passed).toBe(false);
  });

  it("should return ready=false when in_progress tasks exist", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
        makeNode({ id: "t2", status: "in_progress" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true });

    const ipCheck = result.checks.find((c) => c.name === "no_in_progress");
    expect(ipCheck?.passed).toBe(false);
  });

  it("should throw DeployReadinessError for null document", () => {
    expect(() => checkDeployReadiness(null as unknown as GraphDocument)).toThrow("Invalid graph document");
  });

  it("should include recommended checks for AC coverage and knowledge", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true, knowledgeCount: 5 });

    const knowledgeCheck = result.checks.find((c) => c.name === "knowledge_captured");
    expect(knowledgeCheck?.passed).toBe(true);
    expect(knowledgeCheck?.severity).toBe("recommended");
  });

  it("should calculate score and grade correctly", () => {
    const doc = makeDoc({
      nodes: [
        makeNode({ id: "t1", status: "done" }),
      ] as GraphDocument["nodes"],
    });

    const result = checkDeployReadiness(doc, { hasSnapshots: true, knowledgeCount: 1 });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["S", "A", "B", "C", "D", "F"]).toContain(result.grade);
  });
});
