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

import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildExploreWebPlan } from "../mcp/tools/graph-explore-web.js";
import { PlanPayloadSchema } from "../mcp/contracts/plan-payload.js";

describe("graph_explore_web — V11 Maestro Phase 4.4", () => {
  afterEach(() => {
    delete process.env.BROWSER_USE_MCP_AVAILABLE;
  });

  it("returns a valid PlanPayload with executor=browser-use", () => {
    const r = buildExploreWebPlan({
      nodeId: "n1",
      goal: "Find the pricing page and capture the highest tier price",
      maxSteps: 5,
      rubric: "Success when a numeric price is extracted from a *.com domain",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(PlanPayloadSchema.safeParse(r.plan).success).toBe(true);
    expect(r.plan.executor).toBe("browser-use");
  });

  it("step is browser_use_run with goal/maxSteps/rubric in args", () => {
    const r = buildExploreWebPlan({
      nodeId: "n1",
      goal: "Find pricing",
      maxSteps: 3,
      rubric: "captured numeric price",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.steps.length).toBe(1);
    expect(r.plan.steps[0].tool).toMatch(/browser_use_run$/);
    expect(r.plan.steps[0].args.goal).toBe("Find pricing");
    expect(r.plan.steps[0].args.maxSteps).toBe(3);
    expect(r.plan.steps[0].args.rubric).toBe("captured numeric price");
  });

  it("postCallback is finish_task with the node id", () => {
    const r = buildExploreWebPlan({
      nodeId: "n42",
      goal: "g",
      maxSteps: 1,
      rubric: "r",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.postCallback?.tool).toBe("finish_task");
    expect((r.plan.postCallback?.args as { nodeId: string }).nodeId).toBe("n42");
  });

  it("rejects empty goal", () => {
    const r = buildExploreWebPlan({ nodeId: "n1", goal: "", maxSteps: 5, rubric: "r" });
    expect(r.ok).toBe(false);
  });

  it("rejects maxSteps <= 0", () => {
    const r = buildExploreWebPlan({ nodeId: "n1", goal: "g", maxSteps: 0, rubric: "r" });
    expect(r.ok).toBe(false);
  });

  it("returns an install hint when BROWSER_USE_MCP_AVAILABLE=false", () => {
    process.env.BROWSER_USE_MCP_AVAILABLE = "false";
    const r = buildExploreWebPlan({ nodeId: "n1", goal: "g", maxSteps: 1, rubric: "r" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/browser.use|claude mcp add/i);
    }
  });

  it("graph-explore-web source has zero direct browser-use imports (maestro contract)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/mcp/tools/graph-explore-web.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/from\s+['"]browser-use/);
    expect(src).not.toMatch(/from\s+['"]browser_use/);
    expect(src).not.toMatch(/^\s*import\s+[^;]+\s+from\s+['"][^'"]*browser_use[^'"]*['"]/m);
  });
});
