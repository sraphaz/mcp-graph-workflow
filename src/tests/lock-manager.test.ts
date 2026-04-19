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
 * Tests for LockManager — lease-based resource locking with TTL.
 *
 * Covers all 5 acceptance criteria:
 * AC1: acquire() on unlocked resource → lock with lease_token
 * AC2: acquire() on locked resource by different agent → LockConflictError
 * AC3: TTL expiry → lock auto-expires, resource available
 * AC4: release(lease_token) → resource freed immediately
 * AC5: renew(lease_token, ttl) → TTL reset
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Database from "better-sqlite3";
import { LockManager } from "../core/store/lock-manager.js";
import { LockConflictError } from "../core/utils/errors.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_locks (
      resource_id   TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL,
      agent_id      TEXT NOT NULL,
      lease_token   TEXT NOT NULL UNIQUE,
      acquired_at   TEXT NOT NULL,
      expires_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resource_locks_agent ON resource_locks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_resource_locks_expires ON resource_locks(expires_at);
  `);
  return db;
}

describe("LockManager", () => {
  let db: Database.Database;
  let lm: LockManager;

  beforeEach(() => {
    db = createDb();
    lm = new LockManager(db);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    db.close();
  });

  // AC1: GIVEN recurso nao lockado WHEN acquire THEN lock adquirido com lease_token
  it("should acquire lock on unlocked resource and return lease_token", () => {
    const result = lm.acquire("node:123", "agent-1", 300);

    expect(result.leaseToken).toBeDefined();
    expect(typeof result.leaseToken).toBe("string");
    expect(result.leaseToken.length).toBeGreaterThan(0);
    expect(result.resourceId).toBe("node:123");
    expect(result.agentId).toBe("agent-1");
  });

  // AC2: GIVEN recurso lockado por agent-1 WHEN agent-2 tenta acquire THEN LockConflictError
  it("should throw LockConflictError when resource locked by another agent", () => {
    lm.acquire("node:123", "agent-1", 300);

    expect(() => lm.acquire("node:123", "agent-2", 300)).toThrow(LockConflictError);

    try {
      lm.acquire("node:123", "agent-2", 300);
    } catch (err) {
      const lockErr = err as LockConflictError;
      expect(lockErr.details.resourceId).toBe("node:123");
      expect(lockErr.details.owner).toBe("agent-1");
    }
  });

  // AC3: GIVEN lock com TTL=300s WHEN 301s passam THEN lock expira
  it("should auto-expire lock after TTL and allow re-acquisition", () => {
    lm.acquire("node:123", "agent-1", 300);

    // Advance time past TTL
    vi.advanceTimersByTime(301_000);

    // Should succeed — lock expired
    const result = lm.acquire("node:123", "agent-2", 300);
    expect(result.agentId).toBe("agent-2");
  });

  // AC4: GIVEN lock ativo WHEN release(lease_token) THEN recurso liberado
  it("should release lock immediately via lease_token", () => {
    const { leaseToken } = lm.acquire("node:123", "agent-1", 300);

    lm.release(leaseToken);

    // Should succeed — lock released
    const result = lm.acquire("node:123", "agent-2", 300);
    expect(result.agentId).toBe("agent-2");
  });

  // AC5: GIVEN lock ativo WHEN renew(lease_token, ttl) THEN TTL resetado
  it("should renew lock TTL", () => {
    const { leaseToken } = lm.acquire("node:123", "agent-1", 300);

    // Advance 200s (within original TTL)
    vi.advanceTimersByTime(200_000);

    // Renew for another 300s
    lm.renew(leaseToken, 300);

    // Advance 200s more (would have expired without renewal at 300s)
    vi.advanceTimersByTime(200_000);

    // Should still be locked (renewed, so expires at 200+300=500s from start)
    expect(() => lm.acquire("node:123", "agent-2", 300)).toThrow(LockConflictError);

    // Advance past renewed TTL
    vi.advanceTimersByTime(200_000);

    // Now expired
    const result = lm.acquire("node:123", "agent-2", 300);
    expect(result.agentId).toBe("agent-2");
  });

  // Edge: same agent can re-acquire their own lock
  it("should allow same agent to re-acquire their own lock", () => {
    lm.acquire("node:123", "agent-1", 300);

    const result = lm.acquire("node:123", "agent-1", 600);
    expect(result.agentId).toBe("agent-1");
  });

  // Edge: release with invalid token
  it("should throw on release with invalid lease_token", () => {
    expect(() => lm.release("invalid-token")).toThrow();
  });

  // Edge: renew with invalid token
  it("should throw on renew with invalid lease_token", () => {
    expect(() => lm.renew("invalid-token", 300)).toThrow();
  });

  // Edge: default TTL
  it("should use default TTL of 300s when not specified", () => {
    const result = lm.acquire("node:456", "agent-1");

    expect(result.leaseToken).toBeDefined();

    // Should be locked for 300s
    vi.advanceTimersByTime(299_000);
    expect(() => lm.acquire("node:456", "agent-2")).toThrow(LockConflictError);

    vi.advanceTimersByTime(2_000);
    const result2 = lm.acquire("node:456", "agent-2");
    expect(result2.agentId).toBe("agent-2");
  });

  // ── isHeldByOther ──────────────────────────────────────

  describe("isHeldByOther", () => {
    it("should return lock info when resource is held by a different agent", () => {
      lm.acquire("node:123", "agent-1", 300);

      const info = lm.isHeldByOther("node:123", "agent-2");
      expect(info).toBeTruthy();
      expect(info!.agentId).toBe("agent-1");
      expect(info!.resourceId).toBe("node:123");
    });

    it("should return null when resource is held by the same agent", () => {
      lm.acquire("node:123", "agent-1", 300);

      const info = lm.isHeldByOther("node:123", "agent-1");
      expect(info).toBeNull();
    });

    it("should return null when resource is not locked", () => {
      const info = lm.isHeldByOther("node:123", "agent-1");
      expect(info).toBeNull();
    });

    it("should return null when lock is expired", () => {
      lm.acquire("node:123", "agent-1", 300);
      vi.advanceTimersByTime(301_000);

      const info = lm.isHeldByOther("node:123", "agent-2");
      expect(info).toBeNull();
    });
  });

  // ── listActive ─────────────────────────────────────────

  describe("listActive", () => {
    it("should return all active (non-expired) locks", () => {
      lm.acquire("node:1", "agent-1", 300);
      lm.acquire("node:2", "agent-2", 300);

      const active = lm.listActive();
      expect(active).toHaveLength(2);
      expect(active.map((l) => l.resourceId).sort()).toEqual(["node:1", "node:2"]);
    });

    it("should exclude expired locks", () => {
      lm.acquire("node:1", "agent-1", 300);
      lm.acquire("node:2", "agent-2", 10); // 10s TTL

      vi.advanceTimersByTime(11_000);

      const active = lm.listActive();
      expect(active).toHaveLength(1);
      expect(active[0].resourceId).toBe("node:1");
    });

    it("should return empty array when no locks exist", () => {
      const active = lm.listActive();
      expect(active).toHaveLength(0);
    });
  });

  // ── cleanExpired (public) ──────────────────────────────

  describe("cleanExpired", () => {
    it("should remove expired locks and return count", () => {
      lm.acquire("node:1", "agent-1", 10);
      lm.acquire("node:2", "agent-2", 10);
      lm.acquire("node:3", "agent-3", 600); // still active

      vi.advanceTimersByTime(11_000);

      const cleaned = lm.cleanExpired();
      expect(cleaned).toBe(2);

      const total = db.prepare("SELECT COUNT(*) as count FROM resource_locks").get() as { count: number };
      expect(total.count).toBe(1);
    });

    it("should return 0 when no expired locks", () => {
      lm.acquire("node:1", "agent-1", 300);
      const cleaned = lm.cleanExpired();
      expect(cleaned).toBe(0);
    });
  });
});
