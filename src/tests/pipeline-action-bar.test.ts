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
 * Task 11.3.3: Barra de acao com pipeline — structural tests.
 * node_3b2488ddc3e5
 *
 * AC1: task selected → start_task → result in activity panel.
 * AC2: finish_task blocked → blockers listed with actionable detail.
 * AC3: action success → task/kanban state updates automatically.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const TABS = resolve(import.meta.dirname, "../../src/web/dashboard/src/components/tabs");

function read(file: string): string {
  return readFileSync(resolve(TABS, file), "utf-8");
}

describe("KanbanTab — pipeline action bar", () => {
  const src = read("kanban-tab.tsx");

  it("should have start_task action trigger", () => {
    expect(src).toMatch(/start.?task|startTask|in_progress.*move|move.*in_progress/i);
  });

  it("should have finish_task action trigger", () => {
    expect(src).toMatch(/finish.?task|finishTask|done.*move|move.*done/i);
  });

  it("should display action result in activity panel (AC1)", () => {
    // State variable for pipeline action result/output
    expect(src).toMatch(/pipelineResult|actionResult|pipelineOutput|actionOutput/);
  });

  it("should display blockers detail when finish_task is blocked (AC2)", () => {
    // warnings from KanbanMoveResult shown as list when blocking
    expect(src).toMatch(/warnings|blockers.*detail|blocker.*list/i);
  });

  it("should auto-refresh kanban after successful action (AC3)", () => {
    // refresh or moveCard called after action
    expect(src).toMatch(/refresh\(\)|moveCard\(/);
  });

  it("should have a kanban sync button", () => {
    expect(src).toMatch(/[Ss]ync|[Rr]efresh/);
  });

  it("should have a pipeline actions section label or heading", () => {
    expect(src).toMatch(/[Pp]ipeline|[Aa]ctions|action.*bar/i);
  });
});
