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
 * Recovery Metrics Store Tests — TDD
 *
 * Tests persistent storage and retrieval of MTTR-A and rollback metrics.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  RecoveryMetricsStore,
} from "../core/autonomy/recovery-metrics-store.js";

describe("recovery-metrics-store", () => {
  let sqliteStore: SqliteStore;
  let metricsStore: RecoveryMetricsStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Metrics Test");
    metricsStore = new RecoveryMetricsStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  describe("record", () => {
    it("should persist a rollback metric entry", () => {
      metricsStore.record({
        nodeId: "node-42",
        action: "rollback",
        success: true,
        mttrMs: 15,
        attempt: 1,
      });

      const entries = metricsStore.getByNode("node-42");

      expect(entries).toHaveLength(1);
      expect(entries[0].nodeId).toBe("node-42");
      expect(entries[0].mttrMs).toBe(15);
      expect(entries[0].success).toBe(true);
    });
  });

  describe("getSummary", () => {
    it("should compute aggregate metrics", () => {
      metricsStore.record({ nodeId: "n1", action: "rollback", success: true, mttrMs: 10, attempt: 1 });
      metricsStore.record({ nodeId: "n2", action: "rollback", success: true, mttrMs: 20, attempt: 1 });
      metricsStore.record({ nodeId: "n3", action: "escalation", success: false, mttrMs: 30, attempt: 3 });

      const summary = metricsStore.getSummary();

      expect(summary.totalRollbacks).toBe(2);
      expect(summary.totalEscalations).toBe(1);
      expect(summary.avgMttrMs).toBe(20);
      expect(summary.successRate).toBeCloseTo(0.67, 1);
    });

    it("should return zeros for empty store", () => {
      const summary = metricsStore.getSummary();

      expect(summary.totalRollbacks).toBe(0);
      expect(summary.totalEscalations).toBe(0);
      expect(summary.avgMttrMs).toBe(0);
      expect(summary.successRate).toBe(1);
    });
  });

  describe("getRecent", () => {
    it("should return most recent entries limited by count", () => {
      metricsStore.record({ nodeId: "n1", action: "rollback", success: true, mttrMs: 10, attempt: 1 });
      metricsStore.record({ nodeId: "n2", action: "rollback", success: true, mttrMs: 20, attempt: 2 });
      metricsStore.record({ nodeId: "n3", action: "escalation", success: false, mttrMs: 30, attempt: 3 });

      const recent = metricsStore.getRecent(2);

      expect(recent).toHaveLength(2);
      // All 3 were inserted, but only 2 returned
      const all = metricsStore.getRecent(10);
      expect(all).toHaveLength(3);
    });
  });
});
