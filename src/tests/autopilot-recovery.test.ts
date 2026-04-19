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
 * Autopilot + Recovery Integration Tests — TDD
 *
 * Tests that autopilot-controller connects to recovery-orchestrator
 * when tasks fail, triggering rollback + retry loop.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import { AutopilotController } from "../core/autonomy/autopilot-controller.js";
import { RecoveryOrchestrator } from "../core/autonomy/recovery-orchestrator.js";
import {
  AutopilotRecoveryBridge,
} from "../core/autonomy/autopilot-recovery-bridge.js";

describe("autopilot-recovery-bridge", () => {
  let store: SqliteStore;
  let autopilot: AutopilotController;
  let recovery: RecoveryOrchestrator;
  let bridge: AutopilotRecoveryBridge;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Bridge Test");
    autopilot = new AutopilotController({
      maxConsecutiveFailures: 2,
      checkpointEvery: 5,
      minHarnessScore: 70,
      minConfidence: 50,
    });
    recovery = new RecoveryOrchestrator(store, { maxRetries: 3 });
    bridge = new AutopilotRecoveryBridge(autopilot, recovery);
  });

  afterEach(() => {
    store.close();
  });

  describe("onTaskStart", () => {
    it("should create checkpoint via recovery orchestrator", () => {
      const node = makeNode({ title: "Task A" });
      store.insertNode(node);

      bridge.onTaskStart(node.id);

      expect(recovery.hasCheckpoint(node.id)).toBe(true);
    });
  });

  describe("onTaskSuccess", () => {
    it("should record success in both autopilot and recovery", () => {
      autopilot.start("sprint-1");
      const node = makeNode({ title: "Task OK" });
      store.insertNode(node);

      bridge.onTaskStart(node.id);
      const result = bridge.onTaskSuccess(node.id);

      expect(result.autopilotAction).toBe("continue");
      expect(recovery.hasCheckpoint(node.id)).toBe(false);

      const session = autopilot.getSession();
      expect(session?.tasksCompleted).toBe(1);
    });
  });

  describe("onTaskFailure", () => {
    it("should rollback and record failure in autopilot", () => {
      autopilot.start("sprint-1");
      const node = makeNode({ title: "Task Fail", status: "in_progress" });
      store.insertNode(node);

      bridge.onTaskStart(node.id);
      store.updateNodeStatus(node.id, "done"); // work to undo

      const result = bridge.onTaskFailure(node.id, "test failed");

      expect(result.rolledBack).toBe(true);
      expect(result.canRetry).toBe(true);

      const session = autopilot.getSession();
      expect(session?.tasksFailed).toBe(1);
    });

    it("should escalate after max retries", () => {
      autopilot.start("sprint-1");
      const node = makeNode({ title: "Stuck task" });
      store.insertNode(node);

      for (let i = 0; i < 3; i++) {
        bridge.onTaskStart(node.id);
        bridge.onTaskFailure(node.id, `fail ${i + 1}`);
      }

      const metrics = recovery.getMetrics();
      expect(metrics.escalations).toBe(1);
    });
  });

  describe("getRecoveryMetrics", () => {
    it("should expose combined metrics", () => {
      const node = makeNode({ title: "Metrics" });
      store.insertNode(node);

      bridge.onTaskStart(node.id);
      bridge.onTaskFailure(node.id, "fail");

      const metrics = bridge.getRecoveryMetrics();

      expect(metrics.totalRollbacks).toBe(1);
      expect(metrics.avgMttrMs).toBeGreaterThanOrEqual(0);
    });
  });
});
