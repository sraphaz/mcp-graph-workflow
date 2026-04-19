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
import { graphToCsv } from "../../core/graph/csv-export.js";
import { makeNode } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

function makeDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "p1", name: "Test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("graphToCsv", () => {
  it("should have correct headers as first line", () => {
    const doc = makeDoc([]);
    const result = graphToCsv(doc);
    const firstLine = result.split("\n")[0];
    expect(firstLine).toBe("id,type,title,status,priority,sprint,xpSize,tags,parentId,acceptanceCriteria");
  });

  it("should export node fields correctly", () => {
    const node = makeNode({
      id: "n1",
      type: "task",
      title: "Setup DB",
      status: "done",
      priority: 2,
      sprint: "Sprint-1",
      xpSize: "M",
      tags: ["backend", "db"],
      parentId: "e1",
      acceptanceCriteria: ["DB connected", "Migrations run"],
    });
    const doc = makeDoc([node]);
    const result = graphToCsv(doc);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("n1");
    expect(lines[1]).toContain("task");
    expect(lines[1]).toContain("Setup DB");
    expect(lines[1]).toContain("done");
    expect(lines[1]).toContain("Sprint-1");
    expect(lines[1]).toContain("M");
    expect(lines[1]).toContain("backend;db");
    expect(lines[1]).toContain("e1");
  });

  it("should properly escape titles with commas", () => {
    const node = makeNode({ id: "n1", title: "Task A, Task B" });
    const doc = makeDoc([node]);
    const result = graphToCsv(doc);
    expect(result).toContain('"Task A, Task B"');
  });

  it("should properly escape titles with double quotes", () => {
    const node = makeNode({ id: "n1", title: 'Use "strict" mode' });
    const doc = makeDoc([node]);
    const result = graphToCsv(doc);
    expect(result).toContain('"Use ""strict"" mode"');
  });

  it("should properly escape titles with newlines", () => {
    const node = makeNode({ id: "n1", title: "Line1\nLine2" });
    const doc = makeDoc([node]);
    const result = graphToCsv(doc);
    expect(result).toContain('"Line1\nLine2"');
  });

  it("should filter by status", () => {
    const done = makeNode({ id: "n1", title: "Done", status: "done" });
    const backlog = makeNode({ id: "n2", title: "Backlog", status: "backlog" });
    const doc = makeDoc([done, backlog]);
    const result = graphToCsv(doc, { filterStatus: ["done"] });
    const lines = result.split("\n");
    expect(lines).toHaveLength(2); // header + 1 row
    expect(result).toContain("n1");
    expect(result).not.toContain("n2");
  });

  it("should filter by type", () => {
    const epic = makeNode({ id: "n1", title: "Epic", type: "epic" });
    const task = makeNode({ id: "n2", title: "Task", type: "task" });
    const doc = makeDoc([epic, task]);
    const result = graphToCsv(doc, { filterType: ["task"] });
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(result).not.toContain("n1");
    expect(result).toContain("n2");
  });

  it("should handle missing optional fields gracefully", () => {
    const node = makeNode({ id: "n1", title: "Minimal" });
    const doc = makeDoc([node]);
    const result = graphToCsv(doc);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    // Should not throw, should have empty values for missing fields
    expect(lines[1]).toContain("n1");
  });

  it("should return only headers for empty graph", () => {
    const doc = makeDoc([]);
    const result = graphToCsv(doc);
    const lines = result.split("\n");
    expect(lines).toHaveLength(1);
  });
});
