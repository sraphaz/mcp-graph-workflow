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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildValidateUiPlan } from "../mcp/tools/graph-validate-ui.js";
import { PlanPayloadSchema } from "../mcp/contracts/plan-payload.js";

describe("graph_validate_ui — V11 Maestro Phase 4.3", () => {
  it("returns a valid PlanPayload with executor=playwright", () => {
    const r = buildValidateUiPlan({
      nodeId: "n1",
      url: "http://localhost:3000",
      checks: ["a11y", "console-errors"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(PlanPayloadSchema.safeParse(r.plan).success).toBe(true);
    expect(r.plan.executor).toBe("playwright");
    expect(r.plan.nodeId).toBe("n1");
  });

  it("first step is browser_navigate to the given URL", () => {
    const r = buildValidateUiPlan({
      nodeId: "n1",
      url: "http://localhost:3000/dashboard",
      checks: ["a11y"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.steps[0].tool).toMatch(/browser_navigate$/);
    expect(r.plan.steps[0].args.url).toBe("http://localhost:3000/dashboard");
  });

  it("a11y check adds browser_snapshot", () => {
    const r = buildValidateUiPlan({
      nodeId: "n1",
      url: "http://x",
      checks: ["a11y"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tools = r.plan.steps.map((s) => s.tool);
    expect(tools.some((t) => t.includes("browser_snapshot"))).toBe(true);
  });

  it("console-errors check adds browser_console_messages", () => {
    const r = buildValidateUiPlan({
      nodeId: "n1",
      url: "http://x",
      checks: ["console-errors"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tools = r.plan.steps.map((s) => s.tool);
    expect(tools.some((t) => t.includes("browser_console_messages"))).toBe(true);
  });

  it("network-requests check adds browser_network_requests", () => {
    const r = buildValidateUiPlan({
      nodeId: "n1",
      url: "http://x",
      checks: ["network-requests"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tools = r.plan.steps.map((s) => s.tool);
    expect(tools.some((t) => t.includes("browser_network_requests"))).toBe(true);
  });

  it("multiple checks compose deterministically (navigate first, callback last)", () => {
    const r = buildValidateUiPlan({
      nodeId: "n1",
      url: "http://x",
      checks: ["a11y", "console-errors", "network-requests"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.steps[0].tool).toMatch(/browser_navigate$/);
    expect(r.plan.postCallback?.tool).toBe("finish_task");
  });

  it("rejects empty checks array", () => {
    const r = buildValidateUiPlan({ nodeId: "n1", url: "http://x", checks: [] });
    expect(r.ok).toBe(false);
  });

  it("graph-validate-ui source has zero direct playwright imports (maestro contract)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/mcp/tools/graph-validate-ui.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/from\s+['"]playwright/);
    expect(src).not.toMatch(/from\s+['"]@playwright/);
    // ES import syntax: `import ... from "...playwright..."` — does NOT match
    // narrative mentions like "imports playwright" in JSDoc.
    expect(src).not.toMatch(/^\s*import\s+[^;]+\s+from\s+['"][^'"]*playwright[^'"]*['"]/m);
  });
});
