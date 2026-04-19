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
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { updateGraphFromReport } from "../../core/sandbox/reporter.js";
import { makeNode, makeEpic } from "../helpers/factories.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";

describe("updateGraphFromReport — Wave-12 Reporter.updateGraph", () => {
  let store: SqliteStore;
  let epicId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Reporter Test");
    const epic = makeEpic({ title: "E" });
    store.insertNode(epic);
    epicId = epic.id;
  });

  afterEach(() => {
    store.close();
  });

  function insertAt(status: "backlog" | "ready" | "in_progress" | "blocked" | "done") {
    const task = makeNode({
      title: "sandbox target",
      parentId: epicId,
      status,
    });
    store.insertNode(task);
    return task.id;
  }

  describe("failure reports", () => {
    it("marks an in_progress task as blocked when report.success === false", () => {
      const id = insertAt("in_progress");

      const result = updateGraphFromReport(store, id, { success: false, status: "failure" });

      expect(result.previousStatus).toBe("in_progress");
      expect(result.newStatus).toBe("blocked");
      expect(result.skipped).toBeUndefined();
      expect(store.getNodeById(id)!.status).toBe("blocked");
    });

    it("keeps a blocked task blocked (no churn)", () => {
      const id = insertAt("blocked");

      const result = updateGraphFromReport(store, id, { success: false, status: "failure" });

      expect(result.newStatus).toBeNull();
      expect(result.skipped).toMatch(/already.*blocked/i);
      expect(store.getNodeById(id)!.status).toBe("blocked");
    });

    it("never touches a done task, even on failure", () => {
      const id = insertAt("done");

      const result = updateGraphFromReport(store, id, { success: false, status: "failure" });

      expect(result.newStatus).toBeNull();
      expect(result.skipped).toMatch(/done/i);
      expect(store.getNodeById(id)!.status).toBe("done");
    });
  });

  describe("success reports", () => {
    it("unblocks a blocked task on success, moving it to in_progress", () => {
      const id = insertAt("blocked");

      const result = updateGraphFromReport(store, id, { success: true, status: "success" });

      expect(result.previousStatus).toBe("blocked");
      expect(result.newStatus).toBe("in_progress");
      expect(store.getNodeById(id)!.status).toBe("in_progress");
    });

    it("does NOT auto-promote an in_progress task to done on success", () => {
      // finish_task is the only path to done; reporter must not side-step DoD.
      const id = insertAt("in_progress");

      const result = updateGraphFromReport(store, id, { success: true, status: "success" });

      expect(result.newStatus).toBeNull();
      expect(result.skipped).toMatch(/finish_task|dod|no change/i);
      expect(store.getNodeById(id)!.status).toBe("in_progress");
    });

    it("leaves done alone on success", () => {
      const id = insertAt("done");

      const result = updateGraphFromReport(store, id, { success: true, status: "success" });

      expect(result.newStatus).toBeNull();
      expect(store.getNodeById(id)!.status).toBe("done");
    });
  });

  describe("error handling", () => {
    it("throws NodeNotFoundError when the target node does not exist", () => {
      expect(() =>
        updateGraphFromReport(store, "node_nonexistent", { success: false, status: "failure" }),
      ).toThrow(NodeNotFoundError);
    });
  });

  describe("provenance", () => {
    it("returns the nodeId so callers can log / audit the write", () => {
      const id = insertAt("in_progress");

      const result = updateGraphFromReport(store, id, { success: false, status: "failure" });

      expect(result.nodeId).toBe(id);
    });
  });
});
