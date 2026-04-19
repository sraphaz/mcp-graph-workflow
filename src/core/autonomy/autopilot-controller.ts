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
 * Autopilot Controller — Autonomous Sprint Execution with Safety Guardrails
 *
 * Orchestrates autonomous task execution within a sprint, using
 * confidence scoring and hard-coded guardrails to ensure safety.
 *
 * Based on:
 * - Actor Model (Hewitt, 1973): each terminal operates as isolated actor
 * - CAP Theorem (Brewer, 2000): prioritize consistency in SQLite WAL mode
 * - ADR-015: Sprint Autopilot with Confidence-Gated Execution
 *
 * Safety by Design — guardrails are NON-CONFIGURABLE:
 * - Pause if Harness < 70
 * - Pause after 2 consecutive failures
 * - Pause on risk/decision nodes
 * - Checkpoint every 5 tasks
 * - NEVER push/delete/modify CI
 */

import { computeConfidence, type ConfidenceInput } from "./confidence-scorer.js";
import { z } from "zod/v4";
import { McpGraphError } from "../utils/errors.js";

const EvaluateInputSchema = z.object({
  nextNodeType: z.string().min(1),
  harnessScore: z.number().min(0).max(100),
  ragRelevance: z.number().min(0).max(1),
  historicalSuccessRate: z.number().min(0).max(1),
});
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface AutopilotConfig {
  maxConsecutiveFailures: number;
  checkpointEvery: number;
  minHarnessScore: number;
  minConfidence: number;
  /** Optional callback emitted on pause/stop for HITL escalation (Phase D) */
  onEscalation?: (nodeType: string, action: string, reason: string, metadata: Record<string, unknown>) => void;
}

export interface EvaluateInput {
  nextNodeType: string;
  harnessScore: number;
  ragRelevance: number;
  historicalSuccessRate: number;
}

export interface AutopilotDecision {
  action: "continue" | "pause" | "stop" | "checkpoint";
  reason: string;
  confidence: number;
}

export interface AutopilotSession {
  id: string;
  sprintId: string;
  startedAt: string;
  status: "running" | "paused" | "stopped" | "checkpoint";
  tasksCompleted: number;
  tasksFailed: number;
  consecutiveFailures: number;
}

// ── Constants — SAFETY BY DESIGN ────────────────────────

/** Node types that ALWAYS trigger a pause (non-configurable) */
const PAUSE_NODE_TYPES = new Set(["risk", "decision", "constraint"]);

// ── Controller ──────────────────────────────────────────

export class AutopilotController {
  /**
   * Actions that are NEVER allowed in autopilot mode.
   * This is a static readonly — cannot be overridden.
   */
  static readonly BLOCKED_ACTIONS: readonly string[] = Object.freeze([
    "push",
    "delete_branch",
    "modify_ci",
    "force_push",
    "delete_remote",
    "modify_permissions",
  ]);

  private config: AutopilotConfig;
  private session: AutopilotSession | null = null;

  constructor(config: AutopilotConfig) {
    this.config = config;
  }

  /**
   * Start a new autopilot session for a sprint.
   */
  start(sprintId: string): AutopilotSession {
    if (!sprintId?.trim()) throw new McpGraphError("Sprint ID is required to start autopilot");
    this.session = {
      id: `autopilot_${Date.now()}`,
      sprintId,
      startedAt: new Date().toISOString(),
      status: "running",
      tasksCompleted: 0,
      tasksFailed: 0,
      consecutiveFailures: 0,
    };

    logger.info("autopilot:start", { sessionId: this.session.id, sprintId });
    return this.session;
  }

  /**
   * Evaluate whether to continue with the next task.
   * Applies guardrails in priority order (hard-coded, non-negotiable).
   */
  evaluateNext(input: EvaluateInput): AutopilotDecision {
    if (!input) throw new McpGraphError("EvaluateInput is required");
    const validated = EvaluateInputSchema.safeParse(input);
    if (!validated.success) throw new McpGraphError(`Invalid evaluate input: ${validated.error?.message ?? "validation failed"}`);
    if (!this.session || this.session.status !== "running") {
      return { action: "stop", reason: "No active autopilot session", confidence: 0 };
    }

    // Guardrail 1: Checkpoint every N tasks (non-negotiable)
    if (this.session.tasksCompleted > 0 &&
        this.session.tasksCompleted % this.config.checkpointEvery === 0) {
      this.session.status = "checkpoint";
      logger.info("autopilot:checkpoint", {
        tasksCompleted: this.session.tasksCompleted,
        interval: this.config.checkpointEvery,
      });
      return {
        action: "checkpoint",
        reason: `Human checkpoint required: ${this.session.tasksCompleted} tasks completed`,
        confidence: 100,
      };
    }

    // Guardrail 2: Pause after consecutive failures (non-negotiable)
    if (this.session.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.session.status = "paused";
      const reason = `${this.session.consecutiveFailures} consecutive failure(s) — requires human review`;
      logger.warn("autopilot:pause:failures", {
        consecutiveFailures: this.session.consecutiveFailures,
      });
      this.config.onEscalation?.(input.nextNodeType, "pause", reason, { consecutiveFailures: this.session.consecutiveFailures });
      return { action: "pause", reason, confidence: 0 };
    }

    // Guardrail 3: Pause on risk/decision nodes (non-negotiable)
    if (PAUSE_NODE_TYPES.has(input.nextNodeType)) {
      const reason = `Node type '${input.nextNodeType}' requires human review (risk/decision)`;
      logger.info("autopilot:pause:risk-node", { nodeType: input.nextNodeType });
      this.config.onEscalation?.(input.nextNodeType, "pause", reason, { nodeType: input.nextNodeType });
      return { action: "pause", reason, confidence: 50 };
    }

    // Guardrail 4: Pause if harness score too low (non-negotiable)
    if (input.harnessScore < this.config.minHarnessScore) {
      const reason = `Harness score ${input.harnessScore} below minimum ${this.config.minHarnessScore} — quality gap risk`;
      logger.warn("autopilot:pause:harness", {
        harnessScore: input.harnessScore,
        minRequired: this.config.minHarnessScore,
      });
      this.config.onEscalation?.(input.nextNodeType, "pause", reason, { harnessScore: input.harnessScore });
      return { action: "pause", reason, confidence: 30 };
    }

    // All guardrails passed → use confidence scorer
    const confidenceInput: ConfidenceInput = {
      ragRelevance: input.ragRelevance,
      harnessScore: input.harnessScore,
      historicalSuccessRate: input.historicalSuccessRate,
    };

    const confidence = computeConfidence(confidenceInput);

    if (confidence.action === "stop") {
      this.session.status = "paused";
    }

    return {
      action: confidence.action === "stop" ? "pause" : confidence.action,
      reason: `Confidence score: ${confidence.score} (${confidence.action})`,
      confidence: confidence.score,
    };
  }

  /**
   * Record the result of a task execution.
   */
  recordResult(taskId: string, success: boolean): void {
    if (!this.session) return;

    if (success) {
      this.session.tasksCompleted++;
      this.session.consecutiveFailures = 0;
    } else {
      this.session.tasksFailed++;
      this.session.consecutiveFailures++;
    }

    logger.debug("autopilot:record", {
      taskId,
      success,
      completed: this.session.tasksCompleted,
      failed: this.session.tasksFailed,
      consecutiveFailures: this.session.consecutiveFailures,
    });
  }

  /**
   * Pause the autopilot session.
   */
  pause(reason: string): void {
    if (!this.session) return;
    this.session.status = "paused";
    logger.info("autopilot:pause:manual", { reason });
  }

  /**
   * Resume a paused autopilot session.
   */
  resume(): void {
    if (!this.session) return;
    this.session.status = "running";
    this.session.consecutiveFailures = 0;
    logger.info("autopilot:resume");
  }

  /**
   * Get the current session state.
   */
  getSession(): AutopilotSession | null {
    return this.session ? { ...this.session } : null;
  }
}
