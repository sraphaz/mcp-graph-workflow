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
 * Tests for agent role registration.
 *
 * AC1: registerRole persists agent_role_{taskId} in project settings
 * AC2: Duplicate role → warning (non-blocking)
 * AC3: No role registered → getAgentRole returns null
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  registerAgentRole,
  getAgentRole,
  type AgentRole,
} from "../core/harness/agent-role.js";

describe("agent-role-registration", () => {
  let store: SqliteStore;

  function setup(): SqliteStore {
    store = SqliteStore.open(":memory:");
    store.initProject("role-test");
    return store;
  }

  // AC1: registerRole persists in project settings
  it("should persist agent role in project settings", () => {
    const s = setup();

    const result = registerAgentRole(s, "implementor", "task-123");

    expect(result.role).toBe("implementor");
    expect(result.taskId).toBe("task-123");
    expect(result.registeredAt).toBeDefined();
    expect(result.warning).toBeUndefined();

    // Verify persistence
    const retrieved = getAgentRole(s, "task-123");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.role).toBe("implementor");

    s.close();
  });

  // AC1: Different roles
  it("should support implementor, reviewer, and validator roles", () => {
    const s = setup();
    const roles: AgentRole[] = ["implementor", "reviewer", "validator"];

    for (const role of roles) {
      const taskId = `task-${role}`;
      const result = registerAgentRole(s, role, taskId);
      expect(result.role).toBe(role);

      const retrieved = getAgentRole(s, taskId);
      expect(retrieved!.role).toBe(role);
    }

    s.close();
  });

  // AC2: Duplicate role → warning
  it("should return warning when role already registered for taskId", () => {
    const s = setup();

    registerAgentRole(s, "implementor", "task-123");
    const result = registerAgentRole(s, "reviewer", "task-123");

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("already registered");
    // Should still update (non-blocking)
    expect(result.role).toBe("reviewer");

    s.close();
  });

  // AC2: Same role re-registration → no warning
  it("should not warn when re-registering the same role", () => {
    const s = setup();

    registerAgentRole(s, "implementor", "task-123");
    const result = registerAgentRole(s, "implementor", "task-123");

    expect(result.warning).toBeUndefined();

    s.close();
  });

  // AC3: No role registered → null
  it("should return null when no role registered for taskId", () => {
    const s = setup();

    const result = getAgentRole(s, "task-no-role");
    expect(result).toBeNull();

    s.close();
  });

  // Edge: setting key format
  it("should use agent_role_{taskId} as settings key", () => {
    const s = setup();

    registerAgentRole(s, "validator", "task-456");

    const raw = s.getProjectSetting("agent_role_task-456");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.role).toBe("validator");

    s.close();
  });
});
