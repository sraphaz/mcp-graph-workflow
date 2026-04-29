/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { analyzeDataIntegrity } from "../core/analyzer/data-integrity.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { makeNode } from "./helpers/factories.js";

function buildDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "2026-04-28T00:00:00Z", updatedAt: "2026-04-28T00:00:00Z" },
    meta: { sourceFiles: [], lastImport: null },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
  };
}

describe("analyzeDataIntegrity — registrationRequired guidance (BUG-05)", () => {
  it("registrationRequired=true when no data_table nodes exist", () => {
    const report = analyzeDataIntegrity(buildDoc([
      makeNode({ id: "t1", type: "task", title: "Some task" }),
    ]));

    expect(report.totalTables).toBe(0);
    expect(report.registrationRequired).toBe(true);
  });

  it("message mentions 'data_table' when registrationRequired is true", () => {
    const report = analyzeDataIntegrity(buildDoc([]));
    expect(report.message).toContain("data_table");
  });

  it("registrationRequired is absent when at least one data_table node exists (backward compat)", () => {
    const report = analyzeDataIntegrity(buildDoc([
      makeNode({
        id: "dt1",
        type: "data_table",
        title: "users",
        metadata: { columns: ["id", "name"] },
      }),
    ]));

    expect(report.totalTables).toBe(1);
    expect(report.registrationRequired).toBeUndefined();
    expect(report.message).toBeUndefined();
  });
});
