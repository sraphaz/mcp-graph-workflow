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
import { analyzePerformanceBudgets } from "../../core/analyzer/performance-budget-check.js";
import { makeNode } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

function makeDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "", updatedAt: "" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyzePerformanceBudgets", () => {
  it("should return empty report when no budget nodes exist", () => {
    const doc = makeDoc([makeNode({ type: "task" })]);
    const report = analyzePerformanceBudgets(doc);

    expect(report.totalBudgets).toBe(0);
    expect(report.untestedCount).toBe(0);
    expect(report.budgets).toHaveLength(0);
  });

  it("should report budget with complete metadata and passing status", () => {
    const budget = makeNode({
      type: "performance_budget",
      title: "FPS Budget",
      metadata: { metricName: "fps", threshold: "60", status: "passing" },
    });
    const doc = makeDoc([budget]);
    const report = analyzePerformanceBudgets(doc);

    expect(report.totalBudgets).toBe(1);
    expect(report.untestedCount).toBe(0);
    expect(report.budgets[0].metric).toBe("fps");
    expect(report.budgets[0].threshold).toBe("60");
    expect(report.budgets[0].status).toBe("passing");
  });

  it("should default to untested when status is missing", () => {
    const budget = makeNode({
      type: "performance_budget",
      title: "Load Time",
      metadata: { metricName: "loadTimeMs", threshold: "3000" },
    });
    const doc = makeDoc([budget]);
    const report = analyzePerformanceBudgets(doc);

    expect(report.budgets[0].status).toBe("untested");
    expect(report.untestedCount).toBe(1);
  });

  it("should handle numeric threshold and missing metricName gracefully", () => {
    const budget = makeNode({
      type: "performance_budget",
      title: "Memory Budget",
      metadata: { threshold: 512 },
    });
    const doc = makeDoc([budget]);
    const report = analyzePerformanceBudgets(doc);

    expect(report.budgets[0].metric).toBe("unknown");
    expect(report.budgets[0].threshold).toBe("512");
    expect(report.budgets[0].status).toBe("untested");
  });
});
