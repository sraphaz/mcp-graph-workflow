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
 * LockManager — lease-based resource locking with TTL.
 *
 * Provides acquire/release/renew operations on `resource_locks` table.
 * Locks auto-expire after TTL (default 5 min). Uses SQLite for persistence.
 * Same agent can re-acquire their own lock (idempotent upgrade).
 */

import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { LockConflictError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export interface LockResult {
  resourceId: string;
  agentId: string;
  leaseToken: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface LockInfo {
  resourceId: string;
  resourceType: string;
  agentId: string;
  leaseToken: string;
  acquiredAt: string;
  expiresAt: string;
}

export class LockManager {
  constructor(private readonly db: Database.Database) {}

  /**
   * Acquire a lock on a resource. Same agent can re-acquire (upgrades TTL).
   * Throws LockConflictError if locked by another agent and not expired.
   */
  acquire(resourceId: string, agentId: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): LockResult {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const leaseToken = randomUUID();

    // Clean expired locks first
    this._cleanExpired(now);

    // Check existing lock
    const existing = this.db
      .prepare("SELECT * FROM resource_locks WHERE resource_id = ?")
      .get(resourceId) as LockRow | undefined;

    if (existing) {
      // Lock exists and not expired — check owner
      if (existing.agent_id !== agentId) {
        throw new LockConflictError({
          resourceId,
          owner: existing.agent_id,
          acquiredAt: existing.acquired_at,
          expiresAt: existing.expires_at,
        });
      }

      // Same agent — upgrade lock (new TTL + token)
      this.db
        .prepare(
          `UPDATE resource_locks SET lease_token = ?, acquired_at = ?, expires_at = ?
           WHERE resource_id = ?`,
        )
        .run(leaseToken, now.toISOString(), expiresAt.toISOString(), resourceId);

      logger.debug("lock:acquire:upgrade", { resourceId, agentId });
    } else {
      // No lock — insert new
      const resourceType = resourceId.includes(":") ? resourceId.split(":")[0] : "unknown";
      this.db
        .prepare(
          `INSERT INTO resource_locks (resource_id, resource_type, agent_id, lease_token, acquired_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(resourceId, resourceType, agentId, leaseToken, now.toISOString(), expiresAt.toISOString());

      logger.debug("lock:acquire:new", { resourceId, agentId, ttlSeconds });
    }

    return {
      resourceId,
      agentId,
      leaseToken,
      acquiredAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Release a lock by lease token. Throws if token not found.
   */
  release(leaseToken: string): void {
    const resultValue = this.db
      .prepare("DELETE FROM resource_locks WHERE lease_token = ?")
      .run(leaseToken);

    if (resultValue.changes === 0) {
      throw new Error(`No lock found for lease token "${leaseToken}"`);
    }

    logger.debug("lock:release", { leaseToken });
  }

  /**
   * Renew a lock's TTL by lease token. Throws if token not found.
   */
  renew(leaseToken: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const resultValue = this.db
      .prepare("UPDATE resource_locks SET expires_at = ? WHERE lease_token = ?")
      .run(expiresAt.toISOString(), leaseToken);

    if (resultValue.changes === 0) {
      throw new Error(`No lock found for lease token "${leaseToken}"`);
    }

    logger.debug("lock:renew", { leaseToken, ttlSeconds });
  }

  /**
   * Check if a resource is locked by a different agent (non-expired).
   * Returns lock info if held by another agent, null otherwise.
   */
  isHeldByOther(resourceId: string, agentId: string): LockInfo | null {
    const now = new Date().toISOString();
    const row = this.db
      .prepare("SELECT * FROM resource_locks WHERE resource_id = ? AND expires_at > ?")
      .get(resourceId, now) as LockRow | undefined;

    if (!row || row.agent_id === agentId) {
      return null;
    }

    return toLockInfo(row);
  }

  /**
   * List all active (non-expired) locks.
   */
  listActive(): LockInfo[] {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare("SELECT * FROM resource_locks WHERE expires_at > ?")
      .all(now) as LockRow[];

    return rows.map(toLockInfo);
  }

  /**
   * Remove all expired locks. Returns the number of locks cleaned.
   */
  cleanExpired(): number {
    const now = new Date();
    return this._cleanExpired(now);
  }

  /** Internal clean used by acquire (with provided timestamp). */
  private _cleanExpired(now: Date): number {
    const deleted = this.db
      .prepare("DELETE FROM resource_locks WHERE expires_at < ?")
      .run(now.toISOString());

    if (deleted.changes > 0) {
      logger.debug("lock:clean_expired", { count: deleted.changes });
    }

    return deleted.changes;
  }
}

interface LockRow {
  resource_id: string;
  resource_type: string;
  agent_id: string;
  lease_token: string;
  acquired_at: string;
  expires_at: string;
}

function toLockInfo(row: LockRow): LockInfo {
  return {
    resourceId: row.resource_id,
    resourceType: row.resource_type,
    agentId: row.agent_id,
    leaseToken: row.lease_token,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
  };
}
