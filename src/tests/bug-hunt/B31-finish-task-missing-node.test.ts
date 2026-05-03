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
 * B31 (P1): finish_task on a non-existent node used to return
 *   status:"done" with grade:F and a "Node not found" summary tucked
 *   inside dodReport. Agents/CI reading status:done would think the
 *   work succeeded. Now: surface as status:"blocked" with an explicit
 *   node_not_found blocker. Source: notebook node_423b60dc9dbc.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { finishTask } from "../../core/pipeline/finish-task.js";

describe("B31 — finish_task on non-existent node returns status:blocked", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("b31-test");
    // Skip test gate to avoid nested vitest spawns (per finish-task-contract-gate.test.ts)
    store.setProjectSetting("test_gate_mode", "off");
  });

  afterEach(() => {
    store.close();
  });

  it("blockers include node_not_found and status is NOT done", async () => {
    const result = await finishTask(store, "node_does_not_exist_xyz_123", {
      autoNext: false,
    });

    expect(result.status).not.toBe("done");
    expect(result.status).toBe("blocked");
    expect((result.blockers ?? []).join(" ")).toMatch(/node_not_found/);
  });
});
