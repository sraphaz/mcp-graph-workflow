import type { SqliteStore } from "../store/sqlite-store.js";
import { createCheckpoint, rollbackToCheckpoint, type GraphCheckpoint } from "./graph-rollback.js";
import { logger } from "../utils/logger.js";

export interface RecoveryConfig { maxRetries: number; }
export interface RecoveryResult { rolledBack: boolean; attempt: number; canRetry: boolean; escalate: boolean; mttrMs: number; error?: string; }
export interface RecoveryMetrics { totalRollbacks: number; totalSuccesses: number; escalations: number; avgMttrMs: number; }

export class RecoveryOrchestrator {
  private store: SqliteStore;
  private config: RecoveryConfig;
  private checkpoints = new Map<string, GraphCheckpoint>();
  private retryCounts = new Map<string, number>();
  private mttrSamples: number[] = [];
  private rollbackCount = 0;
  private successCount = 0;
  private escalationCount = 0;

  constructor(store: SqliteStore, config: RecoveryConfig) { this.store = store; this.config = config; }

  beginTask(nodeId: string): GraphCheckpoint {
    const checkpoint = createCheckpoint(this.store, nodeId);
    this.checkpoints.set(nodeId, checkpoint);
    logger.info("recovery:begin", { nodeId, snapshotId: checkpoint.snapshotId });
    return checkpoint;
  }

  failTask(nodeId: string, reason: string): RecoveryResult {
    const checkpoint = this.checkpoints.get(nodeId);
    const attempt = (this.retryCounts.get(nodeId) ?? 0) + 1;
    this.retryCounts.set(nodeId, attempt);
    let mttrMs = 0; let rolledBack = false;
    if (checkpoint) {
      const r = rollbackToCheckpoint(this.store, checkpoint);
      rolledBack = r.success; mttrMs = r.mttrMs;
      this.mttrSamples.push(mttrMs); this.rollbackCount++;
    }
    const canRetry = attempt < this.config.maxRetries;
    const escalate = !canRetry;
    if (escalate) { this.escalationCount++; this.checkpoints.delete(nodeId); this.retryCounts.delete(nodeId); }
    logger.info("recovery:fail", { nodeId, reason, attempt, canRetry, escalate, rolledBack, mttrMs });
    return { rolledBack, attempt, canRetry, escalate, mttrMs };
  }

  succeedTask(nodeId: string): void {
    this.checkpoints.delete(nodeId); this.retryCounts.delete(nodeId); this.successCount++;
    logger.info("recovery:succeed", { nodeId });
  }

  hasCheckpoint(nodeId: string): boolean { return this.checkpoints.has(nodeId); }

  getMetrics(): RecoveryMetrics {
    const avgMttrMs = this.mttrSamples.length > 0 ? Math.round(this.mttrSamples.reduce((a, b) => a + b, 0) / this.mttrSamples.length) : 0;
    return { totalRollbacks: this.rollbackCount, totalSuccesses: this.successCount, escalations: this.escalationCount, avgMttrMs };
  }
}
