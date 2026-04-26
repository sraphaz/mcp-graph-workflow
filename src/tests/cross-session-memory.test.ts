/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  saveHarnessMemory,
  getHarnessMemory,
  type HarnessMemoryState,
} from "../core/harness/cross-session-memory.js";

describe("cross-session-memory", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    // intentionally do NOT initProject — saveHarnessMemory must seed it
  });

  describe("saveHarnessMemory", () => {
    it("persists state into project_settings", () => {
      const state: HarnessMemoryState = {
        lastScore: 72.4,
        lastGrade: "B",
        patterns: ["pattern-a", "pattern-b"],
      };
      saveHarnessMemory(store.getDb(), state);
      const got = getHarnessMemory(store.getDb());
      expect(got).toEqual(state);
    });

    it("upserts — second save overwrites first", () => {
      saveHarnessMemory(store.getDb(), { lastScore: 50, lastGrade: "C", patterns: [] });
      saveHarnessMemory(store.getDb(), { lastScore: 80, lastGrade: "A", patterns: ["x"] });
      const got = getHarnessMemory(store.getDb());
      expect(got?.lastScore).toBe(80);
      expect(got?.lastGrade).toBe("A");
      expect(got?.patterns).toEqual(["x"]);
    });

    it("auto-creates the default project when none exists", () => {
      saveHarnessMemory(store.getDb(), { lastScore: 65, lastGrade: "B", patterns: [] });
      // If ensureProject() did not seed a row, the FK-style lookup would fail.
      // Reading back proves the project_id chain works end-to-end.
      expect(getHarnessMemory(store.getDb())).not.toBeNull();
    });

    it("preserves an empty patterns array", () => {
      saveHarnessMemory(store.getDb(), { lastScore: 42, lastGrade: "D", patterns: [] });
      expect(getHarnessMemory(store.getDb())?.patterns).toEqual([]);
    });
  });

  describe("getHarnessMemory", () => {
    it("returns null when nothing has been saved", () => {
      expect(getHarnessMemory(store.getDb())).toBeNull();
    });

    it("returns null gracefully on corrupted JSON", () => {
      // Seed a project + corrupt setting directly via SQL.
      const now = new Date().toISOString();
      store.getDb().prepare(
        "INSERT OR IGNORE INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ).run("default", "default", now, now);
      store.getDb().prepare(
        "INSERT OR REPLACE INTO project_settings (project_id, key, value, updated_at) VALUES (?, ?, ?, ?)",
      ).run("default", "harness_memory_state", "{not json", now);

      expect(getHarnessMemory(store.getDb())).toBeNull();
    });
  });
});
