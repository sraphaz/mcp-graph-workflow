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

import type { GraphEventBus } from "../events/event-bus.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "escalation-emitter.ts" });

export interface EscalationEvent { type: "pause" | "escalation" | "rollback"; nodeId: string; reason: string; timestamp: string; metadata: Record<string, unknown>; }

export class EscalationEmitter {
  private bus: GraphEventBus;
  private history: EscalationEvent[] = [];
  constructor(bus: GraphEventBus) { this.bus = bus; }

  emitPause(nodeId: string, reason: string, metadata: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    this.history.push({ type: "pause", nodeId, reason, timestamp: ts, metadata });
    this.bus.emit({ type: "autopilot:paused", timestamp: ts, payload: { nodeId, reason, ...metadata } });
    log.info("escalation:pause", { nodeId, reason });
  }

  emitEscalation(nodeId: string, reason: string, metadata: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    this.history.push({ type: "escalation", nodeId, reason, timestamp: ts, metadata });
    this.bus.emit({ type: "autopilot:escalation", timestamp: ts, payload: { nodeId, reason, ...metadata } });
    log.warn("escalation:hitl-needed", { nodeId, reason, ...metadata });
  }

  emitRollback(nodeId: string, success: boolean, mttrMs: number): void {
    const ts = new Date().toISOString();
    this.history.push({ type: "rollback", nodeId, reason: success ? "rollback_success" : "rollback_failed", timestamp: ts, metadata: { success, mttrMs } });
    this.bus.emit({ type: "autopilot:rollback", timestamp: ts, payload: { nodeId, success, mttrMs } });
    log.info("escalation:rollback", { nodeId, success, mttrMs });
  }

  getHistory(): EscalationEvent[] { return [...this.history]; }
}
