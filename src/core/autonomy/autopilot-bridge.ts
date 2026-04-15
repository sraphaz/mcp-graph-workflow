/**
 * Autopilot Bridge — Integration between set_phase and AutopilotController
 *
 * Provides a stateful bridge that manages the autopilot lifecycle
 * when set_phase is called with autopilot=true/false.
 *
 * Backward compatible: when autopilot param is undefined, no-op.
 */

import { AutopilotController, type AutopilotConfig, type AutopilotSession } from "./autopilot-controller.js";
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
   * Check if autopilot is currently active.
   */
  isActive(): boolean {
    return this.active;
  }
}
