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
import { captureFlowSnapshot, getCfdData } from "../core/insights/flow-tracker.js";
import { makeNode, makeEpic } from "./helpers/factories.js";

describe("flow-tracker", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Flow Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("captureFlowSnapshot", () => {
    it("should capture snapshot with correct status counts", () => {
      const epic = makeEpic({ title: "Epic" });
      store.insertNode(epic);
      store.insertNode(makeNode({ title: "T1", parentId: epic.id, status: "backlog" }));
      store.insertNode(makeNode({ title: "T2", parentId: epic.id, status: "ready" }));
      const t3 = makeNode({ title: "T3", parentId: epic.id });
      store.insertNode(t3);
      store.updateNodeStatus(t3.id, "in_progress");

      const project = store.getProject();
      const snapshot = captureFlowSnapshot(store, project!.id);

      expect(snapshot).not.toBeNull();
      // 3 tasks + 1 epic = various statuses
      expect(snapshot!.backlogCount).toBeGreaterThanOrEqual(2); // backlog tasks + epic
      expect(snapshot!.readyCount).toBe(1);
      expect(snapshot!.inProgressCount).toBe(1);
      expect(snapshot!.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should not duplicate snapshot for same date", () => {
      const project = store.getProject();
      const s1 = captureFlowSnapshot(store, project!.id);
      const s2 = captureFlowSnapshot(store, project!.id);

      expect(s1).not.toBeNull();
      expect(s2).not.toBeNull();
      expect(s1!.id).toBe(s2!.id); // Same snapshot returned
    });

    it("should capture with sprint filter", () => {
      store.insertNode(makeNode({ title: "T1", sprint: "S1" }));
      store.insertNode(makeNode({ title: "T2", sprint: "S2" }));

      const project = store.getProject();
      const snapshot = captureFlowSnapshot(store, project!.id, "S1");

      expect(snapshot).not.toBeNull();
      expect(snapshot!.sprint).toBe("S1");
    });
  });

  describe("getCfdData", () => {
    it("should return empty array when no snapshots exist", () => {
      const project = store.getProject();
      const data = getCfdData(store, project!.id);

      expect(data).toEqual([]);
    });

    it("should return snapshots as time-series data", () => {
      const project = store.getProject();
      store.insertNode(makeNode({ title: "T1" }));
      captureFlowSnapshot(store, project!.id);

      const data = getCfdData(store, project!.id);

      expect(data.length).toBe(1);
      expect(data[0]).toHaveProperty("snapshotDate");
      expect(data[0]).toHaveProperty("backlogCount");
      expect(data[0]).toHaveProperty("readyCount");
      expect(data[0]).toHaveProperty("inProgressCount");
      expect(data[0]).toHaveProperty("blockedCount");
      expect(data[0]).toHaveProperty("doneCount");
    });
  });
});
