/**
 * AgentHeartbeat — periodic lock renewal and heartbeat event publishing.
 *
 * Runs inside the MCP server process. On each tick:
 * 1. Renews all active locks held by this agent
 * 2. Publishes an agent:heartbeat event via the event bridge
 */

import type { LockManager } from "../store/lock-manager.js";
import type { SqliteEventBridge } from "../events/sqlite-event-bridge.js";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const DEFAULT_INTERVAL_MS = 30_000; // 30 seconds
const LOCK_RENEWAL_TTL_SECONDS = 600; // 10 minutes

export class AgentHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly lockManager: LockManager,
    private readonly eventBridge: SqliteEventBridge,
    private readonly agentId: string,
  ) {}

  /**
   * Start the heartbeat interval.
   */
  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (!this.agentId) {
      throw new McpGraphError("AgentHeartbeat requires a valid agentId");
    }
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        logger.warn("agent-heartbeat:tick_error", { error: String(err) });
      }
    }, intervalMs);
    logger.info("agent-heartbeat:started", { agentId: this.agentId, intervalMs });
  }

  /**
   * Stop the heartbeat interval.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.debug("agent-heartbeat:stopped", { agentId: this.agentId });
    }
  }

  /**
   * Execute one heartbeat tick: renew locks + publish event.
   */
  tick(): void {
    // 1. Renew all active locks held by this agent
    const activeLocks = this.lockManager.listActive()
      .filter((l) => l.agentId === this.agentId);

    for (const lock of activeLocks) {
      try {
        this.lockManager.renew(lock.leaseToken, LOCK_RENEWAL_TTL_SECONDS);
      } catch (err) {
        logger.warn("agent-heartbeat:renew_failed", {
          resourceId: lock.resourceId,
          error: String(err),
        });
      }
    }

    // 2. Publish heartbeat event
    this.eventBridge.publish({
      type: "agent:heartbeat",
      timestamp: new Date().toISOString(),
      payload: {
        agentId: this.agentId,
        activeLocks: activeLocks.length,
      },
    });

    logger.debug("agent-heartbeat:tick", {
      agentId: this.agentId,
      renewedLocks: activeLocks.length,
    });
  }
}
