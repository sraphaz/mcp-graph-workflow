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
import { buildLifecycleBlock } from "../mcp/lifecycle-wrapper.js";
import { detectWarnings } from "../core/planner/lifecycle-phase.js";
import { getSkillByName } from "../core/skills/built-in-skills.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

function makeDoc(nodes: Array<{ type: string; status: string; sprint?: string | null; acceptanceCriteria?: string[] }> = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: nodes.map((n, i) => ({
      id: `node_${i}`,
      type: n.type,
      title: `Node ${i}`,
      status: n.status,
      priority: 3 as const,
      sprint: n.sprint ?? null,
      acceptanceCriteria: n.acceptanceCriteria,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    })),
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  } as unknown as GraphDocument;
}

describe("buildLifecycleBlock", () => {
  it("should return a lifecycle block with phase info", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("IMPLEMENT");
    expect(block.reminder).toBeTruthy();
    expect(block.suggestedNext).toBeInstanceOf(Array);
    expect(block.suggestedNext.length).toBeGreaterThan(0);
    expect(block.principles).toBeInstanceOf(Array);
  });

  it("should return ANALYZE phase for empty graph", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("ANALYZE");
  });

  it("should include all required fields including warnings", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const block = buildLifecycleBlock(doc);

    expect(block).toHaveProperty("phase");
    expect(block).toHaveProperty("reminder");
    expect(block).toHaveProperty("suggestedNext");
    expect(block).toHaveProperty("principles");
    expect(block).toHaveProperty("warnings");
    expect(block.warnings).toBeInstanceOf(Array);
  });

  it("should include recommendedSkills for empty graph (ANALYZE phase)", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("ANALYZE");
    expect(block.recommendedSkills).toBeDefined();
    expect(block.recommendedSkills!.length).toBeGreaterThan(0);
    expect(block.recommendedSkills!.length).toBeLessThanOrEqual(3);
  });

  it("should include recommendedSkills for IMPLEMENT phase with in_progress tasks", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress", sprint: "s1" },
      { type: "task", status: "in_progress", sprint: "s1" },
      { type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("IMPLEMENT");
    expect(block.recommendedSkills).toBeDefined();
    expect(block.recommendedSkills!.length).toBeLessThanOrEqual(3);
  });

  it("should only recommend skills that exist in built-in registry", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);

    if (block.recommendedSkills) {
      for (const rec of block.recommendedSkills) {
        expect(getSkillByName(rec.skill), `Ghost skill "${rec.skill}" in recommendedSkills`).toBeDefined();
      }
    }
  });

  it("should not include suggestedSkills (removed for token optimization)", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);
    expect(block.suggestedSkills).toBeUndefined();
  });
});

describe("detectWarnings", () => {
  it("should error when update_status is called in ANALYZE phase (strict default)", () => {
    const doc = makeDoc();
    const warnings = detectWarnings(doc, "ANALYZE", "update_status");

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === "premature_status_change")).toBe(true);
    const prematureWarning = warnings.find((w) => w.code === "premature_status_change")!;
    expect(prematureWarning.severity).toBe("error");
  });

  it("should warn when update_status is called in PLAN without sprint", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog" },
    ]);
    const warnings = detectWarnings(doc, "PLAN", "update_status");

    expect(warnings.some((w) => w.code === "no_sprint_assigned")).toBe(true);
  });

  it("should emit info when tool is not in suggestedTools for current phase", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "import_prd");

    expect(warnings.some((w) => w.code === "tool_not_recommended" && w.severity === "info")).toBe(true);
  });

  it("should return empty warnings when workflow is correct", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "next");

    expect(warnings).toHaveLength(0);
  });

  it("should warn when task done without acceptance_criteria in IMPLEMENT phase", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
    ]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "update_status");

    expect(warnings.some((w) => w.code === "no_acceptance_criteria")).toBe(true);
  });

  it("should not warn about acceptance_criteria when they exist", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
      { type: "acceptance_criteria", status: "done" },
    ]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "update_status");

    expect(warnings.some((w) => w.code === "no_acceptance_criteria")).toBe(false);
  });

  it("should not warn about acceptance_criteria when inline ACs exist on task nodes", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1", acceptanceCriteria: ["deve retornar status 200"] },
    ]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "update_status");

    expect(warnings.some((w) => w.code === "no_acceptance_criteria")).toBe(false);
  });

  it("should not emit tool_not_recommended for update_node (deprecated exempt)", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "update_node");

    expect(warnings.some((w) => w.code === "tool_not_recommended")).toBe(false);
  });
});

describe("buildLifecycleBlock suggestedSkills (removed for token optimization)", () => {
  it("should not include suggestedSkills in any phase", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);
    expect(block.suggestedSkills).toBeUndefined();
  });
});

describe("buildLifecycleBlock suggestedMcpAgents (removed for token optimization)", () => {
  it("should not include suggestedMcpAgents in any phase", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);
    expect(block.suggestedMcpAgents).toBeUndefined();
  });
});
