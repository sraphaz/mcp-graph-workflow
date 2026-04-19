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
 * Autopilot Bridge — Integration between set_phase and AutopilotController
 *
 * Provides a stateful bridge that manages the autopilot lifecycle
 * when set_phase is called with autopilot=true/false.
 *
 * Backward compatible: when autopilot param is undefined, no-op.
 */

import { AutopilotController, type AutopilotConfig, type AutopilotSession } from "./autopilot-controller.js";
import { AutopilotRecoveryBridge } from "./autopilot-recovery-bridge.js";
import { SessionChainManager } from "../context/session-chain.js";
import { SessionRecallStore } from "../context/session-recall.js";
import type { GraphEventBus } from "../events/event-bus.js";
import type Database from "better-sqlite3";
import { z } from "zod/v4";
import { McpGraphError } from "../utils/errors.js";

const PhaseChangeInputSchema = z.object({
  phase: z.string().min(1),
  autopilot: z.boolean().optional(),
  sprintId: z.string().optional(),
});
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface PhaseChangeResult {
  autopilotActive: boolean;
  action: "started" | "stopped" | "unchanged" | "already_running";
  sessionId?: string;
  summary?: AutopilotSession;
}

// ── Default Config ──────────────────────────────────────

const DEFAULT_CONFIG: AutopilotConfig = {
  maxConsecutiveFailures: 2,
  checkpointEvery: 5,
  minHarnessScore: 70,
  minConfidence: 50,
};

// ── Bridge ──────────────────────────────────────────────

export class AutopilotBridge {
  private controller: AutopilotController | null = null;
  private recoveryBridge: AutopilotRecoveryBridge | null = null;
  private active = false;

  /**
   * Handle a set_phase call with optional autopilot parameter.
   *
   * @param phase - Current lifecycle phase
   * @param autopilot - true=start, false=stop, undefined=no-op
   * @param sprintId - Sprint identifier (required when starting)
   */
  handlePhaseChange(
    phase: string,
    autopilot: boolean | undefined,
    sprintId?: string,
  ): PhaseChangeResult {
    if (!phase?.trim()) throw new McpGraphError("Phase is required for autopilot phase change");
    const _validated = PhaseChangeInputSchema.safeParse({ phase, autopilot, sprintId });
    // No autopilot param → backward compatible no-op
    if (autopilot === undefined) {
      return { autopilotActive: this.active, action: "unchanged" };
    }

    // Enable autopilot
    if (autopilot) {
      if (this.active && this.controller) {
        return {
          autopilotActive: true,
          action: "already_running",
          sessionId: this.controller.getSession()?.id,
        };
      }

      this.controller = new AutopilotController(DEFAULT_CONFIG);
      const session = this.controller.start(sprintId ?? `${phase}-auto`);
      this.active = true;

      logger.info("autopilot-bridge:started", { phase, sprintId, sessionId: session.id });

      return {
        autopilotActive: true,
        action: "started",
        sessionId: session.id,
      };
    }

    // Disable autopilot
    if (!autopilot && this.active && this.controller) {
      const summary = this.controller.getSession();
      this.controller.pause("set_phase autopilot=false");
      this.active = false;

      logger.info("autopilot-bridge:stopped", {
        phase,
        tasksCompleted: summary?.tasksCompleted,
        tasksFailed: summary?.tasksFailed,
      });

      return {
        autopilotActive: false,
        action: "stopped",
        summary: summary ?? undefined,
      };
    }

    return { autopilotActive: false, action: "unchanged" };
  }

  /**
   * Get the active controller (null if not running).
   */
  getController(): AutopilotController | null {
    return this.active ? this.controller : null;
  }

  /**
   * Get the recovery bridge (null if not running).
   * Used by pipeline to access AutopilotRecoveryBridge for coordinated rollback.
   */
  getRecoveryBridge(): AutopilotRecoveryBridge | null {
    return this.active ? this.recoveryBridge : null;
  }

  /**
   * Set the recovery bridge (called by pipeline after creating RecoveryOrchestrator with store).
   */
  setRecoveryBridge(bridge: AutopilotRecoveryBridge): void {
    this.recoveryBridge = bridge;
    logger.info("autopilot-bridge:recovery-initialized");
  }

  /**
   * Check if autopilot is currently active.
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Subscribe to context:pressure_warning events from the event bus.
   * When autopilot is active and context pressure fires, creates a child session
   * to allow continuation in a fresh context window.
   * Returns an unsubscribe function.
   */
  subscribeToEventBus(db: Database.Database, eventBus: GraphEventBus): () => void {
    const handler = (): void => {
      if (!this.active || !this.controller) return;
      const session = this.controller.getSession();
      if (!session) return;

      try {
        const recallStore = new SessionRecallStore(db);
        const chainManager = new SessionChainManager(recallStore);
        const childId = chainManager.createChildSession(session.id, "context_pressure");
        eventBus.emitTyped("session:chained", {
          parentSessionId: session.id,
          childSessionId: childId,
          reason: "context_pressure",
        });
        logger.info("autopilot-bridge:session-chained", {
          parentSessionId: session.id,
          childSessionId: childId,
        });
      } catch (err) {
        logger.warn("autopilot-bridge:session-chain-failed", { error: String(err) });
      }
    };

    eventBus.on("context:pressure_warning", handler);
    return () => eventBus.off("context:pressure_warning", handler);
  }
}
