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
import { computeNextAction } from "../core/planner/next-action.js";

describe("computeNextAction", () => {
  it("should recommend analyze(prd_quality) after import_prd", () => {
    const action = computeNextAction("import_prd", {}, "ANALYZE");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("analyze");
    expect(action!.args?.mode).toBe("prd_quality");
    expect(action!.priority).toBe("recommended");
  });

  it("should recommend plan_sprint after analyze(prd_quality)", () => {
    const action = computeNextAction("analyze", { mode: "prd_quality" }, "ANALYZE");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("plan_sprint");
  });

  it("should recommend sync_stack_docs after plan_sprint", () => {
    const action = computeNextAction("plan_sprint", {}, "PLAN");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("sync_stack_docs");
  });

  it("should recommend start_task after sync_stack_docs", () => {
    const action = computeNextAction("sync_stack_docs", {}, "PLAN");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("start_task");
  });

  it("should return null after start_task (agent implements)", () => {
    const action = computeNextAction("start_task", {}, "IMPLEMENT");
    expect(action).toBeNull();
  });

  it("should recommend start_task after finish_task success", () => {
    const action = computeNextAction("finish_task", {}, "IMPLEMENT", { status: "done" });
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("start_task");
    expect(action!.priority).toBe("recommended");
  });

  it("should return required fix hint after finish_task failure", () => {
    const action = computeNextAction("finish_task", {}, "IMPLEMENT", { status: "blocked", blockers: ["has_acceptance_criteria: missing AC"] });
    expect(action).not.toBeNull();
    expect(action!.priority).toBe("required");
    expect(action!.hint).toContain("AC");
  });

  it("should recommend start_task after update_status(done)", () => {
    const action = computeNextAction("update_status", { status: "done" }, "IMPLEMENT");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("start_task");
  });

  it("should recommend validate after set_phase(VALIDATE)", () => {
    const action = computeNextAction("set_phase", { mode: "VALIDATE" }, "VALIDATE");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("validate");
  });

  it("should recommend analyze(design_ready) after design tools", () => {
    const action = computeNextAction("edge", {}, "DESIGN");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("analyze");
    expect(action!.args?.mode).toBe("design_ready");
  });

  it("should recommend export after analyze(review_ready)", () => {
    const action = computeNextAction("analyze", { mode: "review_ready" }, "REVIEW");
    expect(action).not.toBeNull();
    expect(action!.tool).toBe("export");
  });

  it("should return null for read-only tools like list, show, search", () => {
    expect(computeNextAction("list", {}, "IMPLEMENT")).toBeNull();
    expect(computeNextAction("show", {}, "IMPLEMENT")).toBeNull();
    expect(computeNextAction("search", {}, "IMPLEMENT")).toBeNull();
    expect(computeNextAction("help", {}, "IMPLEMENT")).toBeNull();
  });
});
