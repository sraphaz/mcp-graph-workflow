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
 * TDD: Harness check in HANDOFF phase (delivery-checklist).
 * Validates that checkHandoffReadiness includes harness_handoff_grade check.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkHandoffReadiness } from "../../core/handoff/delivery-checklist.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

// Mock harness cache to control score
vi.mock("../../core/harness/harness-cache.js", () => ({
  runHarnessScanCached: vi.fn(),
}));

import { runHarnessScanCached } from "../../core/harness/harness-cache.js";
const mockHarnessScan = vi.mocked(runHarnessScanCached);

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
    createdAt: n.createdAt ?? "2025-01-01T00:00:00Z",
    updatedAt: n.updatedAt ?? "2025-01-02T00:00:00Z",
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

function allDoneDoc(): GraphDocument {
  return makeDoc([
    { id: "e1", type: "epic", title: "Epic", status: "done" },
    {
      id: "t1", type: "task", title: "Task 1", status: "done",
      parentId: "e1", description: "Done task",
      acceptanceCriteria: ["Given X, when Y, then Z"],
    },
  ]);
}

describe("HANDOFF phase — harness_handoff_grade check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should include harness_handoff_grade check when scan succeeds", () => {
    mockHarnessScan.mockReturnValue({
      score: 72,
      grade: "B",
      breakdown: {},
      details: [],
      timestamp: "2026-01-01",
      ruleSuggestions: [],
    } as unknown as ReturnType<typeof runHarnessScanCached>);

    const report = checkHandoffReadiness(allDoneDoc(), { knowledgeCount: 1 });
    const harnessCheck = report.checks.find((c) => c.name === "harness_handoff_grade");

    expect(harnessCheck).toBeDefined();
    expect(harnessCheck!.passed).toBe(true);
    expect(harnessCheck!.severity).toBe("recommended");
  });

  it("should pass when score >= 55 (grade C)", () => {
    mockHarnessScan.mockReturnValue({
      score: 58,
      grade: "C",
      breakdown: {},
      details: [],
      timestamp: "2026-01-01",
      ruleSuggestions: [],
    } as unknown as ReturnType<typeof runHarnessScanCached>);

    const report = checkHandoffReadiness(allDoneDoc(), { knowledgeCount: 1 });
    const harnessCheck = report.checks.find((c) => c.name === "harness_handoff_grade");

    expect(harnessCheck).toBeDefined();
    expect(harnessCheck!.passed).toBe(true);
  });

  it("should fail when score < 55 (grade D)", () => {
    mockHarnessScan.mockReturnValue({
      score: 42,
      grade: "D",
      breakdown: {},
      details: [],
      timestamp: "2026-01-01",
      ruleSuggestions: [],
    } as unknown as ReturnType<typeof runHarnessScanCached>);

    const report = checkHandoffReadiness(allDoneDoc(), { knowledgeCount: 1 });
    const harnessCheck = report.checks.find((c) => c.name === "harness_handoff_grade");

    expect(harnessCheck).toBeDefined();
    expect(harnessCheck!.passed).toBe(false);
  });

  it("should omit check silently when scan throws", () => {
    mockHarnessScan.mockImplementation(() => {
      throw new Error("Scan unavailable");
    });

    const report = checkHandoffReadiness(allDoneDoc(), { knowledgeCount: 1 });
    const harnessCheck = report.checks.find((c) => c.name === "harness_handoff_grade");

    expect(harnessCheck).toBeUndefined();
  });

  it("should omit check when scan returns null", () => {
    mockHarnessScan.mockReturnValue(null);

    const report = checkHandoffReadiness(allDoneDoc(), { knowledgeCount: 1 });
    const harnessCheck = report.checks.find((c) => c.name === "harness_handoff_grade");

    expect(harnessCheck).toBeUndefined();
  });
});
