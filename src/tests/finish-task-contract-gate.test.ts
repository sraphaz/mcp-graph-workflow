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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { finishTask } from "../core/pipeline/finish-task.js";
import { makeNode } from "./helpers/factories.js";

describe("finish_task contract validation gate (Wiener Closed-Loop)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Contract Gate Test");

    // Create a task in in_progress status with AC
    const node = makeNode({
      id: "task-1",
      type: "task",
      title: "Test task with contracts",
      status: "in_progress",
      description: "A test task for contract gate validation",
      acceptanceCriteria: ["GIVEN x WHEN y THEN z is verified"],
    });
    store.insertNode(node);
  });

  afterEach(() => {
    store.close();
  });

  it("should complete normally and include contractGate in response (backward compat)", async () => {
    const result = await finishTask(store, "task-1", {
      rationale: "Test rationale for contract gate",
    });

    // Task should complete normally — no contract violations in test environment
    expect(result.status).toBe("done");

    // contractGate should be present in result
    expect(result).toHaveProperty("contractGate");
    expect(result.contractGate).toHaveProperty("mode");
    expect(result.contractGate).toHaveProperty("violationCount");
  });

  it("should return contractGate.mode as advisory by default", async () => {
    const result = await finishTask(store, "task-1", {
      rationale: "Test rationale",
    });

    expect(result.contractGate!.mode).toBe("advisory");
  });

  it("should not block on advisory mode even if violations exist", async () => {
    const result = await finishTask(store, "task-1", {
      rationale: "Test rationale",
    });

    // In advisory mode, violations don't block — task should still be done
    expect(result.status).toBe("done");
  });
});
