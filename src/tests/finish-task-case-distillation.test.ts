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
import { buildCaseMemory, MIN_RATIONALE_LENGTH } from "../core/memory/case-distillation.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_abc",
    type: "task",
    title: "Fix the thing",
    status: "done",
    priority: 3,
    description: "do the work",
    acceptanceCriteria: ["does X", "does Y"],
    tags: ["bug-fix"],
    ...overrides,
  } as GraphNode;
}

describe("case-distillation — case-based experiential memory builder", () => {
  it("returns shouldWrite=false when grade is not A", () => {
    const r = buildCaseMemory({ node: makeNode(), grade: "B", rationale: "x".repeat(200), testFiles: ["src/tests/x.test.ts"] });
    expect(r.shouldWrite).toBe(false);
  });

  it("returns shouldWrite=false when rationale is too short", () => {
    const r = buildCaseMemory({ node: makeNode(), grade: "A", rationale: "ok", testFiles: ["src/tests/x.test.ts"] });
    expect(r.shouldWrite).toBe(false);
  });

  it("returns shouldWrite=false when testFiles is empty", () => {
    const r = buildCaseMemory({ node: makeNode(), grade: "A", rationale: "x".repeat(200), testFiles: [] });
    expect(r.shouldWrite).toBe(false);
  });

  it("returns shouldWrite=true and a well-formed payload when all gates pass", () => {
    const node = makeNode();
    const rationale = "Implemented the X path by routing through Y; tests cover the edge cases.".padEnd(MIN_RATIONALE_LENGTH + 20, " more details");
    const r = buildCaseMemory({ node, grade: "A", rationale, testFiles: ["src/tests/x.test.ts"] });
    expect(r.shouldWrite).toBe(true);
    expect(r.name).toMatch(/^case_node_abc_\d{4}-\d{2}-\d{2}$/);
    expect(r.content).toContain("name: case_node_abc");
    expect(r.content).toContain("type: feedback");
    expect(r.content).toContain("Fix the thing");
    expect(r.content).toContain("does X");
    expect(r.content).toContain("does Y");
    expect(r.content).toContain(rationale);
    expect(r.content).toContain("src/tests/x.test.ts");
    expect(r.content).toContain("case-based");
  });

  it("includes a tag list including 'experiential' and 'case-based'", () => {
    const r = buildCaseMemory({ node: makeNode({ tags: ["v13.2.x", "feedback-loop"] }), grade: "A", rationale: "x".repeat(MIN_RATIONALE_LENGTH + 1), testFiles: ["t.test.ts"] });
    expect(r.shouldWrite).toBe(true);
    expect(r.content).toMatch(/experiential/);
    expect(r.content).toMatch(/case-based/);
  });

  it("uses the node's existing tags as additional context when present", () => {
    const r = buildCaseMemory({ node: makeNode({ tags: ["bug-fix", "refactor"] }), grade: "A", rationale: "x".repeat(MIN_RATIONALE_LENGTH + 1), testFiles: ["t.test.ts"] });
    expect(r.content).toContain("bug-fix");
    expect(r.content).toContain("refactor");
  });
});
