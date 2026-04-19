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

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { DelegationEngine, MAX_CONCURRENT } from "../core/agents/delegation-engine.js";
import { runMigrations } from "../core/store/migrations.js";

describe("DelegationEngine", () => {
  let db: Database.Database;
  let engine: DelegationEngine;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    engine = new DelegationEngine(db);
  });

  it("should create a delegation entry", () => {
    const id = engine.create("agent_parent", {
      objective: "Implement authentication",
      allowedTools: ["node", "edge", "search"],
    });

    expect(id).toBeTruthy();
    const entry = engine.getById(id);
    expect(entry).not.toBeNull();
    expect(entry!.parentAgentId).toBe("agent_parent");
    expect(entry!.objective).toBe("Implement authentication");
    expect(entry!.status).toBe("running");
    expect(entry!.depth).toBe(1);
  });

  it("should enforce max depth of 2", () => {
    const d1 = engine.create("agent_root", {
      objective: "Level 1 task",
      allowedTools: ["search"],
    }, 1);

    expect(d1).toBeTruthy();

    const d2 = engine.create("agent_child", {
      objective: "Level 2 task",
      allowedTools: ["search"],
    }, 2);

    expect(d2).toBeTruthy();

    // Depth 3 should be rejected
    expect(() => {
      engine.create("agent_grandchild", {
        objective: "Level 3 task",
        allowedTools: ["search"],
      }, 3);
    }).toThrow(/max delegation depth/i);
  });

  it("should enforce max concurrent delegations", () => {
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      engine.create(`agent_${i}`, {
        objective: `Task ${i}`,
        allowedTools: ["search"],
      });
    }

    expect(() => {
      engine.create("agent_overflow", {
        objective: "One too many",
        allowedTools: ["search"],
      });
    }).toThrow(/max concurrent/i);
  });

  it("should complete a delegation", () => {
    const id = engine.create("agent_1", {
      objective: "Do something",
      allowedTools: ["search"],
    });

    engine.complete(id, "Task completed successfully", 1500);

    const entry = engine.getById(id);
    expect(entry!.status).toBe("completed");
    expect(entry!.resultSummary).toBe("Task completed successfully");
    expect(entry!.tokensUsed).toBe(1500);
    expect(entry!.completedAt).toBeTruthy();
  });

  it("should fail a delegation", () => {
    const id = engine.create("agent_1", {
      objective: "Do something risky",
      allowedTools: ["search"],
    });

    engine.fail(id, "Error: permission denied");

    const entry = engine.getById(id);
    expect(entry!.status).toBe("failed");
    expect(entry!.resultSummary).toContain("permission denied");
  });

  it("should list active delegations for a parent", () => {
    engine.create("agent_parent", {
      objective: "Task 1",
      allowedTools: ["search"],
    });
    const d2 = engine.create("agent_parent", {
      objective: "Task 2",
      allowedTools: ["node"],
    });
    engine.complete(d2, "Done", 0);

    const active = engine.getActiveForParent("agent_parent");
    expect(active).toHaveLength(1);
    expect(active[0].objective).toBe("Task 1");
  });

  it("should count only running delegations toward concurrent limit", () => {
    const d1 = engine.create("agent_1", { objective: "T1", allowedTools: ["search"] });
    engine.create("agent_2", { objective: "T2", allowedTools: ["search"] });
    engine.create("agent_3", { objective: "T3", allowedTools: ["search"] });

    // All 3 slots taken
    expect(() => {
      engine.create("agent_4", { objective: "T4", allowedTools: ["search"] });
    }).toThrow(/max concurrent/i);

    // Complete one — frees a slot
    engine.complete(d1, "Done", 0);

    // Now should succeed
    const d4 = engine.create("agent_4", { objective: "T4", allowedTools: ["search"] });
    expect(d4).toBeTruthy();
  });
});
