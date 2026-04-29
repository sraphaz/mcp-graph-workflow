/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type Database from "better-sqlite3";
import { LockManager } from "../store/lock-manager.js";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getSharedHookBus } from "../hooks/shared-hook-bus.js";

const CLAIM_TTL_SECONDS = 300;

export class AgentClaimConflictError extends McpGraphError {
  readonly retryable = true;

  constructor(resourceId: string, lockedBy: string) {
    super(`Resource "${resourceId}" already claimed by agent "${lockedBy}"`);
    this.name = "AgentClaimConflictError";
  }
}

export interface ClaimResult {
  resourceId: string;
  agentId: string;
  leaseToken: string;
  expiresAt: string;
}

/** Thin wrapper over LockManager that provides agent-task claim semantics. */
export class AgentClaimManager {
  private readonly locks: LockManager;

  constructor(db: Database.Database) {
    this.locks = new LockManager(db);
  }

  /** Claim a resource for an agent. Throws AgentClaimConflictError (retryable) on collision. */
  claim(resourceId: string, agentId: string, ttlSeconds: number = CLAIM_TTL_SECONDS): ClaimResult {
    void getSharedHookBus().emit({
      channel: "agent:pre-spawn",
      timestamp: new Date().toISOString(),
      payload: { agentId, resourceId },
    });
    try {
      const result = this.locks.acquire(resourceId, agentId, ttlSeconds);
      logger.debug("swarm:claim", { resourceId, agentId });
      void getSharedHookBus().emit({
        channel: "agent:post-spawn",
        timestamp: new Date().toISOString(),
        payload: { agentId, resourceId, status: "success" },
      });
      return {
        resourceId: result.resourceId,
        agentId: result.agentId,
        leaseToken: result.leaseToken,
        expiresAt: result.expiresAt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void getSharedHookBus().emit({
        channel: "agent:post-spawn",
        timestamp: new Date().toISOString(),
        payload: { agentId, resourceId, status: "failure", error: message },
      });
      if (err instanceof Error && err.name === "LockConflictError") {
        const conflict = err as Error & { details?: { owner?: string } };
        throw new AgentClaimConflictError(resourceId, conflict.details?.owner ?? "unknown");
      }
      throw err;
    }
  }

  /** Release a claim by lease token. Idempotent — ignores missing tokens. */
  release(leaseToken: string): void {
    try {
      this.locks.release(leaseToken);
      logger.debug("swarm:release", { leaseToken });
    } catch {
      // token already gone — idempotent
    }
  }

  /** Remove expired claims. Returns count of swept locks. */
  sweepStale(): number {
    const count = this.locks.cleanExpired();
    if (count > 0) {
      logger.info("swarm:sweep", { swept: count });
    }
    return count;
  }
}
