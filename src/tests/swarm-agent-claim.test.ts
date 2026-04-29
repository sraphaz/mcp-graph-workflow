/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { AgentClaimManager } from "../core/swarm/agent-claim-manager.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("AgentClaimManager.claim", () => {
  let db: Database.Database;
  let claims: AgentClaimManager;

  beforeEach(() => {
    db = createDb();
    claims = new AgentClaimManager(db);
  });

  it("returns a lease token on successful claim", () => {
    const result = claims.claim("task-1", "agent-A");
    expect(result.leaseToken).toBeTruthy();
    expect(typeof result.leaseToken).toBe("string");
  });

  it("collision — second agent claiming same resource throws retryable error", () => {
    claims.claim("task-1", "agent-A");
    let caught: unknown;
    try {
      claims.claim("task-1", "agent-B");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    const e = caught as { retryable?: boolean; message?: string };
    expect(e.retryable).toBe(true);
    expect(typeof e.message).toBe("string");
  });

  it("same agent re-claiming own resource upgrades TTL (idempotent)", () => {
    const first = claims.claim("task-1", "agent-A");
    const second = claims.claim("task-1", "agent-A");
    expect(second.leaseToken).toBeTruthy();
    expect(first.leaseToken).not.toBe(second.leaseToken);
  });
});

describe("AgentClaimManager.release", () => {
  let db: Database.Database;
  let claims: AgentClaimManager;

  beforeEach(() => {
    db = createDb();
    claims = new AgentClaimManager(db);
  });

  it("release frees the lock so another agent can claim", () => {
    const result = claims.claim("task-1", "agent-A");
    claims.release(result.leaseToken);
    expect(() => claims.claim("task-1", "agent-B")).not.toThrow();
  });

  it("releasing an already-released token does not throw (idempotent)", () => {
    const result = claims.claim("task-1", "agent-A");
    claims.release(result.leaseToken);
    expect(() => claims.release(result.leaseToken)).not.toThrow();
  });
});

describe("AgentClaimManager.sweepStale", () => {
  let db: Database.Database;
  let claims: AgentClaimManager;

  beforeEach(() => {
    db = createDb();
    claims = new AgentClaimManager(db);
  });

  it("sweepStale returns count of cleaned locks (zero when none expire)", () => {
    claims.claim("task-1", "agent-A");
    const count = claims.sweepStale();
    expect(typeof count).toBe("number");
    expect(count).toBe(0);
  });

  it("sweepStale with expired locks clears them and returns count", () => {
    claims.claim("task-1", "agent-A", -1);
    const count = claims.sweepStale();
    expect(count).toBeGreaterThan(0);
  });

  it("after sweepStale, expired resources can be claimed by new agent", () => {
    claims.claim("task-2", "agent-A", -1);
    claims.sweepStale();
    expect(() => claims.claim("task-2", "agent-B")).not.toThrow();
  });
});
