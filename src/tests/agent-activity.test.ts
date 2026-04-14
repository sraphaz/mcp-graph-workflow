import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { getAgentActivity } from "../core/insights/agent-activity.js";
import type { AgentActivityInfo } from "../core/insights/agent-activity.js";

describe("getAgentActivity", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Agent Activity Test");
  });

  afterEach(() => {
    store.close();
  });

  function insertHeartbeat(db: ReturnType<typeof store["getDb"]>, agentId: string, createdAt: string): void {
    db.prepare(
      "INSERT INTO event_queue (event_type, payload, agent_id, created_at) VALUES (?, ?, ?, ?)",
    ).run("agent:heartbeat", JSON.stringify({ agentId }), agentId, createdAt);
  }

  function insertLock(db: ReturnType<typeof store["getDb"]>, agentId: string, resourceId: string, expiresAt: string): void {
    db.prepare(
      "INSERT INTO resource_locks (resource_id, resource_type, agent_id, lease_token, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(resourceId, "task", agentId, `token-${resourceId}`, new Date().toISOString(), expiresAt);
  }

  it("should return empty array when no agents", () => {
    const db = store.getDb();
    const result = getAgentActivity(db);
    expect(result).toEqual([]);
  });

  it("should detect agents from heartbeat events", () => {
    const db = store.getDb();
    const now = new Date().toISOString();
    insertHeartbeat(db, "agent-1", now);
    insertHeartbeat(db, "agent-2", now);

    const result = getAgentActivity(db);
    expect(result).toHaveLength(2);

    const ids = result.map((a: AgentActivityInfo) => a.agentId).sort();
    expect(ids).toEqual(["agent-1", "agent-2"]);
  });

  it("should show active status for recent heartbeats", () => {
    const db = store.getDb();
    const now = new Date().toISOString();
    insertHeartbeat(db, "agent-1", now);

    const result = getAgentActivity(db);
    const agent = result[0];

    expect(agent.status).toBe("active");
    expect(agent.lastHeartbeat).toBe(now);
  });

  it("should show stale status for heartbeats older than 60s", () => {
    const db = store.getDb();
    const oldTime = new Date(Date.now() - 120_000).toISOString(); // 2 min ago
    insertHeartbeat(db, "agent-old", oldTime);

    const result = getAgentActivity(db);
    const agent = result[0];

    expect(agent.status).toBe("stale");
  });

  it("should count active locks per agent", () => {
    const db = store.getDb();
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 300_000).toISOString(); // 5 min future

    insertHeartbeat(db, "agent-1", now);
    insertLock(db, "agent-1", "task:node_abc", future);
    insertLock(db, "agent-1", "task:node_def", future);

    const result = getAgentActivity(db);
    const agent = result.find((a: AgentActivityInfo) => a.agentId === "agent-1");

    expect(agent?.activeLocks).toBe(2);
  });

  it("should not count expired locks", () => {
    const db = store.getDb();
    const now = new Date().toISOString();
    const past = new Date(Date.now() - 60_000).toISOString(); // expired

    insertHeartbeat(db, "agent-1", now);
    insertLock(db, "agent-1", "task:node_expired", past);

    const result = getAgentActivity(db);
    const agent = result.find((a: AgentActivityInfo) => a.agentId === "agent-1");

    expect(agent?.activeLocks).toBe(0);
  });

  it("should use most recent heartbeat per agent", () => {
    const db = store.getDb();
    const old = new Date(Date.now() - 120_000).toISOString();
    const recent = new Date().toISOString();

    insertHeartbeat(db, "agent-1", old);
    insertHeartbeat(db, "agent-1", recent);

    const result = getAgentActivity(db);
    expect(result).toHaveLength(1);
    expect(result[0].lastHeartbeat).toBe(recent);
    expect(result[0].status).toBe("active");
  });

  it("should include current task from locked resources", () => {
    const db = store.getDb();
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 300_000).toISOString();

    insertHeartbeat(db, "agent-1", now);
    insertLock(db, "agent-1", "task:node_abc123", future);

    const result = getAgentActivity(db);
    const agent = result[0];

    expect(agent.currentTaskId).toBe("node_abc123");
  });
});
