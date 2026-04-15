import type { GraphEventBus } from "../events/event-bus.js";
import { logger } from "../utils/logger.js";

export interface EscalationEvent { type: "pause" | "escalation" | "rollback"; nodeId: string; reason: string; timestamp: string; metadata: Record<string, unknown>; }

export class EscalationEmitter {
  private bus: GraphEventBus;
  private history: EscalationEvent[] = [];
  constructor(bus: GraphEventBus) { this.bus = bus; }

  emitPause(nodeId: string, reason: string, metadata: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    this.history.push({ type: "pause", nodeId, reason, timestamp: ts, metadata });
    this.bus.emit({ type: "autopilot:paused", timestamp: ts, payload: { nodeId, reason, ...metadata } });
    logger.info("escalation:pause", { nodeId, reason });
  }

  emitEscalation(nodeId: string, reason: string, metadata: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    this.history.push({ type: "escalation", nodeId, reason, timestamp: ts, metadata });
    this.bus.emit({ type: "autopilot:escalation", timestamp: ts, payload: { nodeId, reason, ...metadata } });
    logger.warn("escalation:hitl-needed", { nodeId, reason, ...metadata });
  }

  emitRollback(nodeId: string, success: boolean, mttrMs: number): void {
    const ts = new Date().toISOString();
    this.history.push({ type: "rollback", nodeId, reason: success ? "rollback_success" : "rollback_failed", timestamp: ts, metadata: { success, mttrMs } });
    this.bus.emit({ type: "autopilot:rollback", timestamp: ts, payload: { nodeId, success, mttrMs } });
    logger.info("escalation:rollback", { nodeId, success, mttrMs });
  }

  getHistory(): EscalationEvent[] { return [...this.history]; }
}
