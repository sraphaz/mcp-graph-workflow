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
 * Tests for AgentRegistry — agent registration with heartbeat.
 *
 * AC1: registerAgent → registered with last_heartbeat = now
 * AC2: No heartbeat for 60s → status = "inactive"
 * AC3: listAgents → list with status and active locks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { AgentRegistry } from "../core/store/agent-registry.js";

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
  `);
  return db;
}

describe("AgentRegistry", () => {
  let db: Database.Database;
  let registry: AgentRegistry;

  beforeEach(() => {
    db = createDb();
    registry = new AgentRegistry(db);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    db.close();
  });

  // AC1: registerAgent → registered with last_heartbeat
  it("should register an agent with capabilities and heartbeat", () => {
    registry.registerAgent("claude-1", ["implement", "review"]);

    const agents = registry.listAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].agentId).toBe("claude-1");
    expect(agents[0].capabilities).toEqual(["implement", "review"]);
    expect(agents[0].status).toBe("active");
    expect(agents[0].lastHeartbeat).toBeDefined();
  });

  // AC1: Heartbeat updates timestamp
  it("should update heartbeat on re-register", () => {
    registry.registerAgent("claude-1", ["implement"]);
    vi.advanceTimersByTime(30_000);
    registry.heartbeat("claude-1");

    const agents = registry.listAgents();
    expect(agents[0].status).toBe("active");
  });

  // AC2: No heartbeat for 60s → inactive
  it("should mark agent as inactive after 60s without heartbeat", () => {
    registry.registerAgent("claude-1", ["implement"]);
    vi.advanceTimersByTime(61_000);

    const agents = registry.listAgents();
    expect(agents[0].status).toBe("inactive");
  });

  // AC2: Agent that heartbeats within 60s stays active
  it("should stay active if heartbeat within 60s", () => {
    registry.registerAgent("claude-1", ["implement"]);
    vi.advanceTimersByTime(50_000);
    registry.heartbeat("claude-1");
    vi.advanceTimersByTime(50_000); // 50s after heartbeat

    const agents = registry.listAgents();
    expect(agents[0].status).toBe("active");
  });

  // AC3: listAgents with multiple agents
  it("should list all registered agents with status", () => {
    registry.registerAgent("claude-1", ["implement"]);
    registry.registerAgent("claude-2", ["review"]);
    registry.registerAgent("claude-3", ["validate"]);

    const agents = registry.listAgents();
    expect(agents).toHaveLength(3);
    expect(agents.every((a) => a.status === "active")).toBe(true);
  });

  // AC3: listAgents includes active locks
  it("should include active locks count for each agent", () => {
    registry.registerAgent("claude-1", ["implement"]);

    // Insert a lock for claude-1
    const now = new Date();
    const future = new Date(now.getTime() + 300_000);
    db.prepare(`INSERT INTO resource_locks VALUES (?, ?, ?, ?, ?, ?)`)
      .run("node:123", "node", "claude-1", "token-1", now.toISOString(), future.toISOString());

    const agents = registry.listAgents();
    expect(agents[0].activeLocks).toBe(1);
  });

  // Edge: unregister agent
  it("should remove agent on unregister", () => {
    registry.registerAgent("claude-1", ["implement"]);
    registry.unregisterAgent("claude-1");

    const agents = registry.listAgents();
    expect(agents).toHaveLength(0);
  });

  // Edge: heartbeat for unknown agent
  it("should ignore heartbeat for unregistered agent", () => {
    expect(() => registry.heartbeat("unknown")).not.toThrow();
  });
});
