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
 * Recovery Orchestrator Tests — TDD RED then GREEN
 *
 * Tests the orchestration layer that connects:
 * graph-rollback + context pruning + retry logic
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  RecoveryOrchestrator,
} from "../core/autonomy/recovery-orchestrator.js";

describe("recovery-orchestrator", () => {
  let store: SqliteStore;
  let orchestrator: RecoveryOrchestrator;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Recovery Test");
    orchestrator = new RecoveryOrchestrator(store, { maxRetries: 3 });
  });

  afterEach(() => {
    store.close();
  });

  describe("beginTask", () => {
    it("should create a checkpoint before task execution", () => {
      const node = makeNode({ title: "Task A", status: "in_progress" });
      store.insertNode(node);

      const checkpoint = orchestrator.beginTask(node.id);

      expect(checkpoint.nodeId).toBe(node.id);
      expect(checkpoint.snapshotId).toBeGreaterThan(0);
    });

    it("should track the checkpoint for later rollback", () => {
      const node = makeNode({ title: "Task A" });
      store.insertNode(node);

      orchestrator.beginTask(node.id);

      expect(orchestrator.hasCheckpoint(node.id)).toBe(true);
    });
  });

  describe("failTask", () => {
    it("should rollback graph state on failure", () => {
      const node = makeNode({ title: "A", status: "in_progress" });
      store.insertNode(node);

      orchestrator.beginTask(node.id);

      // Simulate work that should be undone
      store.updateNodeStatus(node.id, "done");

      const result = orchestrator.failTask(node.id, "Test failed");

      expect(result.rolledBack).toBe(true);
      expect(result.attempt).toBe(1);
      expect(result.mttrMs).toBeGreaterThanOrEqual(0);

      // Verify state restored
      const doc = store.toGraphDocument();
      const restored = doc.nodes.find((n: { id: string }) => n.id === node.id);
      expect(restored?.status).toBe("in_progress");
    });

    it("should track retry count and respect maxRetries", () => {
      const node = makeNode({ title: "Flaky task" });
      store.insertNode(node);

      orchestrator.beginTask(node.id);
      const r1 = orchestrator.failTask(node.id, "attempt 1");
      expect(r1.canRetry).toBe(true);
      expect(r1.attempt).toBe(1);

      orchestrator.beginTask(node.id);
      const r2 = orchestrator.failTask(node.id, "attempt 2");
      expect(r2.canRetry).toBe(true);
      expect(r2.attempt).toBe(2);

      orchestrator.beginTask(node.id);
      const r3 = orchestrator.failTask(node.id, "attempt 3");
      expect(r3.canRetry).toBe(false);
      expect(r3.attempt).toBe(3);
      expect(r3.escalate).toBe(true);
    });

    it("should clear checkpoint after max retries exhausted", () => {
      const node = makeNode({ title: "Stuck" });
      store.insertNode(node);

      for (let i = 0; i < 3; i++) {
        orchestrator.beginTask(node.id);
        orchestrator.failTask(node.id, `fail ${i + 1}`);
      }

      expect(orchestrator.hasCheckpoint(node.id)).toBe(false);
    });
  });

  describe("succeedTask", () => {
    it("should clear checkpoint on success", () => {
      const node = makeNode({ title: "Task OK" });
      store.insertNode(node);

      orchestrator.beginTask(node.id);
      orchestrator.succeedTask(node.id);

      expect(orchestrator.hasCheckpoint(node.id)).toBe(false);
    });

    it("should reset retry count on success", () => {
      const node = makeNode({ title: "Recovered" });
      store.insertNode(node);

      orchestrator.beginTask(node.id);
      orchestrator.failTask(node.id, "first fail");

      orchestrator.beginTask(node.id);
      orchestrator.succeedTask(node.id);

      // After success, retries should be reset
      orchestrator.beginTask(node.id);
      const r = orchestrator.failTask(node.id, "new fail");
      expect(r.attempt).toBe(1);
    });
  });

  describe("getMetrics", () => {
    it("should track total rollbacks and avg MTTR-A", () => {
      const node = makeNode({ title: "Metrics test" });
      store.insertNode(node);

      orchestrator.beginTask(node.id);
      orchestrator.failTask(node.id, "fail 1");

      orchestrator.beginTask(node.id);
      orchestrator.failTask(node.id, "fail 2");

      const metrics = orchestrator.getMetrics();

      expect(metrics.totalRollbacks).toBe(2);
      expect(metrics.avgMttrMs).toBeGreaterThanOrEqual(0);
      expect(metrics.escalations).toBe(0);
    });
  });
});
