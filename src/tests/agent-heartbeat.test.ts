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
 * TDD tests for AgentHeartbeat — periodic lock renewal and heartbeat events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { AgentHeartbeat } from "../core/agents/agent-heartbeat.js";
import { LockManager } from "../core/store/lock-manager.js";
import { SqliteEventBridge } from "../core/events/sqlite-event-bridge.js";
import { GraphEventBus } from "../core/events/event-bus.js";


function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("AgentHeartbeat", () => {
  let db: Database.Database;
  let lockManager: LockManager;
  let bus: GraphEventBus;
  let bridge: SqliteEventBridge;
  let heartbeat: AgentHeartbeat;

  beforeEach(() => {
    db = createDb();
    lockManager = new LockManager(db);
    bus = new GraphEventBus();
    bridge = new SqliteEventBridge(db, bus, "agent-1");
    heartbeat = new AgentHeartbeat(lockManager, bridge, "agent-1");
    vi.useFakeTimers();
  });

  afterEach(() => {
    heartbeat.stop();
    bridge.stopPolling();
    vi.useRealTimers();
    db.close();
  });

  it("should publish agent:heartbeat event on tick", () => {
    // Read events from the queue directly
    heartbeat.start(30_000);
    heartbeat.tick();

    const rows = db.prepare("SELECT * FROM event_queue WHERE event_type = 'agent:heartbeat'").all();
    expect(rows).toHaveLength(1);
  });

  it("should renew all active locks held by the agent on tick", () => {
    // Acquire a lock with short TTL
    lockManager.acquire("task:node-1", "agent-1", 60); // 60s TTL

    // Advance 50 seconds
    vi.advanceTimersByTime(50_000);

    // Tick — should renew the lock
    heartbeat.tick();

    // Lock should still be active after original TTL would have expired
    vi.advanceTimersByTime(20_000); // 70s total — would have expired without renewal

    const info = lockManager.isHeldByOther("task:node-1", "agent-2");
    expect(info).not.toBeNull(); // Still locked by agent-1
    expect(info!.agentId).toBe("agent-1");
  });

  it("should not renew locks held by other agents", () => {
    lockManager.acquire("task:node-1", "agent-2", 60);

    heartbeat.tick();

    // Lock should still belong to agent-2
    const info = lockManager.isHeldByOther("task:node-1", "agent-1");
    expect(info).not.toBeNull();
    expect(info!.agentId).toBe("agent-2");
  });

  it("should start and stop interval", () => {
    heartbeat.start(30_000);

    // Verify no events initially (start doesn't tick immediately)
    let rows = db.prepare("SELECT COUNT(*) as count FROM event_queue WHERE event_type = 'agent:heartbeat'").get() as { count: number };
    expect(rows.count).toBe(0);

    // Advance past interval — should tick
    vi.advanceTimersByTime(30_001);
    rows = db.prepare("SELECT COUNT(*) as count FROM event_queue WHERE event_type = 'agent:heartbeat'").get() as { count: number };
    expect(rows.count).toBe(1);

    heartbeat.stop();

    // Advance again — should NOT tick
    vi.advanceTimersByTime(30_001);
    rows = db.prepare("SELECT COUNT(*) as count FROM event_queue WHERE event_type = 'agent:heartbeat'").get() as { count: number };
    expect(rows.count).toBe(1); // still 1, not 2
  });
});
