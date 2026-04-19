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

import { describe, it, expect } from "vitest";
import {
  AutopilotController,
  type AutopilotConfig,
} from "../core/autonomy/autopilot-controller.js";

describe("AutopilotController — Hewitt Actor Model + CAP Theorem", () => {
  const defaultConfig: AutopilotConfig = {
    maxConsecutiveFailures: 2,
    checkpointEvery: 5,
    minHarnessScore: 70,
    minConfidence: 50,
  };

  it("should return action=checkpoint after 5 tasks completed", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    // Simulate 5 successful tasks
    for (let i = 0; i < 5; i++) {
      controller.recordResult(`task-${i}`, true);
    }

    const decision = controller.evaluateNext({
      nextNodeType: "task",
      harnessScore: 80,
      ragRelevance: 0.9,
      historicalSuccessRate: 0.9,
    });

    expect(decision.action).toBe("checkpoint");
    expect(decision.reason).toContain("checkpoint");
  });

  it("should return action=pause after 2 consecutive failures", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    controller.recordResult("task-a", false);
    controller.recordResult("task-b", false);

    const decision = controller.evaluateNext({
      nextNodeType: "task",
      harnessScore: 80,
      ragRelevance: 0.9,
      historicalSuccessRate: 0.5,
    });

    expect(decision.action).toBe("pause");
    expect(decision.reason).toContain("failure");
  });

  it("should return action=pause for risk nodes regardless of confidence", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    const decision = controller.evaluateNext({
      nextNodeType: "risk",
      harnessScore: 95,
      ragRelevance: 1.0,
      historicalSuccessRate: 1.0,
    });

    expect(decision.action).toBe("pause");
    expect(decision.reason).toContain("risk");
  });

  it("should return action=pause when harness score < 70", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    const decision = controller.evaluateNext({
      nextNodeType: "task",
      harnessScore: 55,
      ragRelevance: 0.9,
      historicalSuccessRate: 0.9,
    });

    expect(decision.action).toBe("pause");
    expect(decision.reason.toLowerCase()).toContain("harness");
  });

  it("should return action=continue when all guardrails pass", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    controller.recordResult("task-1", true);

    const decision = controller.evaluateNext({
      nextNodeType: "task",
      harnessScore: 85,
      ragRelevance: 0.9,
      historicalSuccessRate: 0.8,
    });

    expect(decision.action).toBe("continue");
  });

  it("should track session stats correctly", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    controller.recordResult("t1", true);
    controller.recordResult("t2", true);
    controller.recordResult("t3", false);

    const session = controller.getSession();
    expect(session).not.toBeNull();
    expect(session!.tasksCompleted).toBe(2);
    expect(session!.tasksFailed).toBe(1);
    expect(session!.status).toBe("running");
  });

  it("should return null session when not started", () => {
    const controller = new AutopilotController(defaultConfig);
    expect(controller.getSession()).toBeNull();
  });

  it("should pause and resume correctly", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    controller.pause("manual pause");
    expect(controller.getSession()!.status).toBe("paused");

    controller.resume();
    expect(controller.getSession()!.status).toBe("running");
  });

  it("should never allow destructive actions (safety by design)", () => {
    const controller = new AutopilotController(defaultConfig);
    controller.start("sprint-1");

    // The BLOCKED_ACTIONS should be non-configurable
    expect(AutopilotController.BLOCKED_ACTIONS).toContain("push");
    expect(AutopilotController.BLOCKED_ACTIONS).toContain("delete_branch");
    expect(AutopilotController.BLOCKED_ACTIONS).toContain("modify_ci");
  });
});
