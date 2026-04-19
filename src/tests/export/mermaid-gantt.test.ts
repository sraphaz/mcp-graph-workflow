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
import { graphToMermaid } from "../../core/graph/mermaid-export.js";
import { makeNode, makeEdge } from "../helpers/factories.js";

describe("buildGantt", () => {
  it("should start gantt output with gantt header", () => {
    const node = makeNode({ id: "t1", title: "Task A", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toMatch(/^gantt\n/);
  });

  it("should include dateFormat and title", () => {
    const node = makeNode({ id: "t1", title: "Task A", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toContain("dateFormat YYYY-MM-DD");
    expect(result).toContain("title Sprint Timeline");
  });

  it("should group tasks by sprint as sections", () => {
    const a = makeNode({ id: "t1", title: "Task A", sprint: "Sprint-1" });
    const b = makeNode({ id: "t2", title: "Task B", sprint: "Sprint-2" });
    const result = graphToMermaid([a, b], [], { format: "gantt" });
    expect(result).toContain("section Sprint-1");
    expect(result).toContain("section Sprint-2");
  });

  it("should place tasks without sprint in Unassigned section", () => {
    const node = makeNode({ id: "t1", title: "Task A" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toContain("section Unassigned");
  });

  it("should mark done tasks with :done prefix", () => {
    const node = makeNode({ id: "t1", title: "Task Done", status: "done", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toContain(":done,");
  });

  it("should mark in_progress tasks with :active prefix", () => {
    const node = makeNode({ id: "t1", title: "Task WIP", status: "in_progress", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toContain(":active,");
  });

  it("should not add status prefix for backlog tasks", () => {
    const node = makeNode({ id: "t1", title: "Task Backlog", status: "backlog", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    const lines = result.split("\n");
    const taskLine = lines.find((l) => l.includes("t1"));
    expect(taskLine).toBeDefined();
    expect(taskLine).not.toContain(":done");
    expect(taskLine).not.toContain(":active");
  });

  it("should calculate duration from estimateMinutes (minimum 1d)", () => {
    const node = makeNode({ id: "t1", title: "Quick task", estimateMinutes: 120, sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    // 120 minutes = 0.25 days -> minimum 1d
    expect(result).toContain("1d");
  });

  it("should use 3d as default duration when no estimate", () => {
    const node = makeNode({ id: "t1", title: "No estimate", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toContain("3d");
  });

  it("should convert larger estimateMinutes to days correctly", () => {
    const node = makeNode({ id: "t1", title: "Big task", estimateMinutes: 2400, sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    // 2400 minutes = 5 days (at 480 min/day)
    expect(result).toContain("5d");
  });

  it("should use after clause for depends_on edges", () => {
    const a = makeNode({ id: "t1", title: "Task A", sprint: "Sprint-1" });
    const b = makeNode({ id: "t2", title: "Task B", sprint: "Sprint-1" });
    const edge = makeEdge("t2", "t1", { relationType: "depends_on" });
    const result = graphToMermaid([a, b], [edge], { format: "gantt" });
    expect(result).toContain("after t1");
  });

  it("should use createdAt as start date when no dependency", () => {
    const node = makeNode({ id: "t1", title: "Task A", sprint: "Sprint-1", createdAt: "2025-06-15T10:00:00Z" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    expect(result).toContain("2025-06-15");
  });

  it("should sanitize task titles removing special chars", () => {
    const node = makeNode({ id: "t1", title: "Task: with; special #chars!", sprint: "Sprint-1" });
    const result = graphToMermaid([node], [], { format: "gantt" });
    const lines = result.split("\n");
    const taskLine = lines.find((l) => l.includes("t1"));
    expect(taskLine).toBeDefined();
    // Title portion (before the first :) should not contain special chars
    const titlePortion = taskLine!.split(":")[0].trim();
    expect(titlePortion).toBe("Task with special chars");
  });

  it("should respect filterStatus option", () => {
    const done = makeNode({ id: "t1", title: "Done", status: "done", sprint: "Sprint-1" });
    const backlog = makeNode({ id: "t2", title: "Backlog", status: "backlog", sprint: "Sprint-1" });
    const result = graphToMermaid([done, backlog], [], { format: "gantt", filterStatus: ["done"] });
    expect(result).toContain("t1");
    expect(result).not.toContain("t2");
  });

  it("should respect filterType option", () => {
    const epic = makeNode({ id: "t1", title: "Epic", type: "epic", sprint: "Sprint-1" });
    const task = makeNode({ id: "t2", title: "Task", type: "task", sprint: "Sprint-1" });
    const result = graphToMermaid([epic, task], [], { format: "gantt", filterType: ["task"] });
    expect(result).not.toContain("t1");
    expect(result).toContain("t2");
  });
});
