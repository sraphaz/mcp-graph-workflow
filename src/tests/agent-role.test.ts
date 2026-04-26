/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAgentRole, getAgentRole } from "../core/harness/agent-role.js";

describe("agent-role", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("agent-role test");
  });

  describe("registerAgentRole", () => {
    it("persists role + taskId + timestamp", () => {
      const r = registerAgentRole(store, "implementor", "task-1");
      expect(r.role).toBe("implementor");
      expect(r.taskId).toBe("task-1");
      expect(r.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(r.warning).toBeUndefined();
    });

    it("returns no warning when re-registering the same role", () => {
      registerAgentRole(store, "reviewer", "task-2");
      const second = registerAgentRole(store, "reviewer", "task-2");
      expect(second.warning).toBeUndefined();
    });

    it("returns warning when overwriting with a different role", () => {
      registerAgentRole(store, "implementor", "task-3");
      const second = registerAgentRole(store, "validator", "task-3");
      expect(second.warning).toBeDefined();
      expect(second.warning).toContain("implementor");
      expect(second.warning).toContain("validator");
    });

    it("supports all three role kinds", () => {
      const a = registerAgentRole(store, "implementor", "t-a");
      const b = registerAgentRole(store, "reviewer", "t-b");
      const c = registerAgentRole(store, "validator", "t-c");
      expect(a.role).toBe("implementor");
      expect(b.role).toBe("reviewer");
      expect(c.role).toBe("validator");
    });

    it("isolates registrations across taskIds", () => {
      registerAgentRole(store, "implementor", "task-X");
      registerAgentRole(store, "reviewer", "task-Y");
      expect(getAgentRole(store, "task-X")?.role).toBe("implementor");
      expect(getAgentRole(store, "task-Y")?.role).toBe("reviewer");
    });
  });

  describe("getAgentRole", () => {
    it("returns null when no role is registered", () => {
      expect(getAgentRole(store, "missing-task")).toBeNull();
    });

    it("returns the stored role + timestamp", () => {
      const before = registerAgentRole(store, "validator", "t-1");
      const got = getAgentRole(store, "t-1");
      expect(got).not.toBeNull();
      expect(got?.role).toBe("validator");
      expect(got?.registeredAt).toBe(before.registeredAt);
    });

    it("returns null gracefully when stored value is corrupted JSON", () => {
      // Force-write garbage under the agent_role_* key — the
      // function must not throw, only return null.
      store.setProjectSetting("agent_role_corrupt", "{not valid json");
      expect(getAgentRole(store, "corrupt")).toBeNull();
    });
  });
});
