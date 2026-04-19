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

import type { AutopilotController } from "./autopilot-controller.js";
import type { RecoveryOrchestrator, RecoveryMetrics } from "./recovery-orchestrator.js";
import { logger } from "../utils/logger.js";

export interface AutopilotRecoveryResult { autopilotAction: string; rolledBack?: boolean; canRetry?: boolean; escalate?: boolean; mttrMs?: number; }

export class AutopilotRecoveryBridge {
  private autopilot: AutopilotController;
  private recovery: RecoveryOrchestrator;
  constructor(autopilot: AutopilotController, recovery: RecoveryOrchestrator) { this.autopilot = autopilot; this.recovery = recovery; }

  onTaskStart(nodeId: string): void { this.recovery.beginTask(nodeId); logger.debug("autopilot-recovery:task-start", { nodeId }); }

  onTaskSuccess(nodeId: string): AutopilotRecoveryResult {
    this.recovery.succeedTask(nodeId); this.autopilot.recordResult(nodeId, true);
    logger.info("autopilot-recovery:task-success", { nodeId });
    return { autopilotAction: "continue" };
  }

  onTaskFailure(nodeId: string, reason: string): AutopilotRecoveryResult {
    const r = this.recovery.failTask(nodeId, reason); this.autopilot.recordResult(nodeId, false);
    logger.info("autopilot-recovery:task-failure", { nodeId, reason, rolledBack: r.rolledBack, canRetry: r.canRetry, escalate: r.escalate, attempt: r.attempt, mttrMs: r.mttrMs });
    return { autopilotAction: r.escalate ? "pause" : "retry", rolledBack: r.rolledBack, canRetry: r.canRetry, escalate: r.escalate, mttrMs: r.mttrMs };
  }

  getRecoveryMetrics(): RecoveryMetrics { return this.recovery.getMetrics(); }
}
