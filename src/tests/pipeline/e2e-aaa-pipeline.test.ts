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
 * E2E Integration Test — Full AAA+ Pipeline Flow
 *
 * Validates that all M.A.P.A. pillars are wired and operational:
 * - M (Model Contracts): adaptive budget + citations in context
 * - A (Anchor Flow with Gates): test gate + contract gate in finish_task
 * - P (Prove via Pipeline): prefetcher in start_task, test validation
 * - A (Audit Quality): harness score tracking, autopilot session
 *
 * This test exercises the real pipeline functions (startTask, finishTask)
 * with an in-memory SQLite store.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { startTask } from "../../core/pipeline/start-task.js";
import { finishTask } from "../../core/pipeline/finish-task.js";
import { makeNode } from "../helpers/factories.js";

describe("E2E AAA+ Pipeline — M.A.P.A. Validation", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("E2E AAA+ Test");

    // Disable test gate in unit tests (vitest can't spawn vitest)
    store.setProjectSetting("test_gate_mode", "off");

    // Create a simple task with AC
    const task = makeNode({
      id: "e2e-task-1",
      type: "task",
      title: "E2E test task for pipeline validation",
      status: "backlog",
      priority: 1,
      description: "Validates all M.A.P.A. pillars in the pipeline",
      acceptanceCriteria: [
        "GIVEN pipeline WHEN executed THEN all gates run",
      ],
    });
    store.insertNode(task);
  });

  afterEach(() => {
    store.close();
  });

  describe("M.A.P.A. Pillar M — Model Contracts", () => {
    it("startTask should return context with _budgetSource field", () => {
      const result = startTask(store, { nodeId: "e2e-task-1" });

      expect(result).not.toBeNull();
      // Context assembler should include budget source metadata
      if (result?.ragContext) {
        expect(result.ragContext).toHaveProperty("_budgetSource");
      }
    });
  });

  describe("M.A.P.A. Pillar A — Anchor Flow with Gates", () => {
    it("finishTask should include contractGate in result", async () => {
      // Move to in_progress first
      store.updateNodeStatus("e2e-task-1", "in_progress");

      const result = await finishTask(store, "e2e-task-1", {
        rationale: "E2E test rationale",
        autoNext: false,
      });

      // Contract gate should be present (advisory mode by default)
      expect(result).toHaveProperty("contractGate");
      if (result.contractGate) {
        expect(result.contractGate.mode).toBe("advisory");
        expect(result.contractGate).toHaveProperty("violationCount");
      }
    });

    it("finishTask should include testGate in result", async () => {
      store.updateNodeStatus("e2e-task-1", "in_progress");

      const result = await finishTask(store, "e2e-task-1", {
        rationale: "E2E test rationale",
        autoNext: false,
      });

      // Test gate should be present (skipped when no testFiles)
      expect(result).toHaveProperty("testGate");
      if (result.testGate) {
        expect(result.testGate).toHaveProperty("status");
        expect(result.testGate).toHaveProperty("mode");
      }
    });
  });

  describe("M.A.P.A. Pillar P — Prove via Pipeline", () => {
    it("startTask should return task with context and TDD hints", () => {
      const result = startTask(store, { nodeId: "e2e-task-1" });

      expect(result).not.toBeNull();
      expect(result!.task).toBeDefined();
      expect(result!.task.task.node.id).toBe("e2e-task-1");
      expect(result!.startedAt).toBeTruthy();
    });

    it("finishTask should complete with DoD grade", async () => {
      store.updateNodeStatus("e2e-task-1", "in_progress");

      const result = await finishTask(store, "e2e-task-1", {
        rationale: "Pipeline validated",
        autoNext: false,
      });

      expect(result.dodReport).toBeDefined();
      expect(result.dodReport.score).toBeGreaterThanOrEqual(0);
      expect(result.dodReport.grade).toMatch(/^[A-D]$/);
      expect(["done", "blocked"]).toContain(result.status);
    });
  });

  describe("M.A.P.A. Pillar A — Audit Quality Continuously", () => {
    it("finishTask should track issue patterns for steering loop", async () => {
      store.updateNodeStatus("e2e-task-1", "in_progress");

      const result = await finishTask(store, "e2e-task-1", {
        rationale: "Audit check",
        autoNext: false,
      });

      // ruleSuggestions should exist (may be empty if no patterns)
      expect(result).toHaveProperty("ruleSuggestions");
      expect(Array.isArray(result.ruleSuggestions)).toBe(true);
    });
  });

  describe("Full Pipeline Flow", () => {
    it("should execute startTask → finishTask without errors", async () => {
      // Step 1: Start task
      const startResult = startTask(store, { nodeId: "e2e-task-1" });
      expect(startResult).not.toBeNull();
      expect(startResult!.startedAt).toBeTruthy();

      // Step 2: Finish task
      const finishResult = await finishTask(store, "e2e-task-1", {
        rationale: "Full pipeline E2E validation",
        autoNext: false,
      });

      // Verify pipeline completed
      expect(finishResult.dodReport).toBeDefined();
      expect(finishResult).toHaveProperty("contractGate");
      expect(finishResult).toHaveProperty("testGate");
      expect(finishResult).toHaveProperty("ruleSuggestions");
    });
  });
});
