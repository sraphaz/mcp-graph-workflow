/**
 * TDD tests for SqliteEventBridge — cross-terminal event propagation via SQLite.
 *
 * Tests: publish, poll, prune, cross-terminal propagation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { SqliteEventBridge } from "../core/events/sqlite-event-bridge.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import type { GraphEvent } from "../core/events/event-types.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("SqliteEventBridge", () => {
  let db: Database.Database;
  let bus: GraphEventBus;
  let bridge: SqliteEventBridge;

  beforeEach(() => {
    db = createDb();
    bus = new GraphEventBus();
    bridge = new SqliteEventBridge(db, bus, "agent-1");
  });

  afterEach(() => {
    bridge.stopPolling();
    db.close();
  });

  // ── publish ──────────────────────────────────────────

  describe("publish", () => {
    it("should insert event into event_queue table", () => {
      const event: GraphEvent = {
        type: "task:claimed",
        timestamp: new Date().toISOString(),
        payload: { nodeId: "task-1", agentId: "agent-1" },
      };

      bridge.publish(event);

      const rows = db.prepare("SELECT * FROM event_queue").all() as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0].event_type).toBe("task:claimed");
      expect(rows[0].agent_id).toBe("agent-1");
      expect(JSON.parse(rows[0].payload as string)).toEqual({ nodeId: "task-1", agentId: "agent-1" });
    });

    it("should auto-increment event IDs", () => {
      bridge.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: {} });
      bridge.publish({ type: "task:released", timestamp: new Date().toISOString(), payload: {} });

      const rows = db.prepare("SELECT id FROM event_queue ORDER BY id").all() as Array<{ id: number }>;
      expect(rows).toHaveLength(2);
      expect(rows[1].id).toBe(rows[0].id + 1);
    });
  });

  // ── pollOnce ─────────────────────────────────────────

  describe("pollOnce", () => {
    it("should re-emit events from other agents on local bus", () => {
      // Agent-2 publishes an event
      const bridge2 = new SqliteEventBridge(db, new GraphEventBus(), "agent-2");
      bridge2.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: { nodeId: "task-1" } });

      // Agent-1 listens and polls
      const received: GraphEvent[] = [];
      bus.on("task:claimed", (e) => received.push(e));

      bridge.pollOnce();

      expect(received).toHaveLength(1);
      expect(received[0].payload.nodeId).toBe("task-1");
    });

    it("should NOT re-emit own events", () => {
      // Agent-1 publishes an event
      bridge.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: { nodeId: "task-1" } });

      const received: GraphEvent[] = [];
      bus.on("task:claimed", (e) => received.push(e));

      bridge.pollOnce();

      expect(received).toHaveLength(0);
    });

    it("should track lastSeenId to avoid re-processing", () => {
      const bridge2 = new SqliteEventBridge(db, new GraphEventBus(), "agent-2");
      bridge2.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: { first: true } });

      const received: GraphEvent[] = [];
      bus.on("task:claimed", (e) => received.push(e));

      bridge.pollOnce();
      expect(received).toHaveLength(1);

      // Poll again — should NOT re-emit
      bridge.pollOnce();
      expect(received).toHaveLength(1);

      // New event from agent-2
      bridge2.publish({ type: "task:released", timestamp: new Date().toISOString(), payload: { second: true } });
      bus.on("task:released", (e) => received.push(e));

      bridge.pollOnce();
      expect(received).toHaveLength(2);
    });
  });

  // ── pruneOld ─────────────────────────────────────────

  describe("pruneOld", () => {
    it("should remove events older than maxAgeMs", () => {
      vi.useFakeTimers();

      bridge.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: {} });

      // Advance past 1 hour
      vi.advanceTimersByTime(3_600_001);

      bridge.publish({ type: "task:released", timestamp: new Date().toISOString(), payload: {} });

      const pruned = bridge.pruneOld(3_600_000);
      expect(pruned).toBe(1);

      const remaining = db.prepare("SELECT COUNT(*) as count FROM event_queue").get() as { count: number };
      expect(remaining.count).toBe(1);

      vi.useRealTimers();
    });

    it("should return 0 when no old events exist", () => {
      bridge.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: {} });

      const pruned = bridge.pruneOld(3_600_000);
      expect(pruned).toBe(0);
    });
  });

  // ── cross-terminal propagation ───────────────────────

  describe("cross-terminal propagation", () => {
    it("should propagate events between two bridges on same DB", () => {
      const bus2 = new GraphEventBus();
      const bridge2 = new SqliteEventBridge(db, bus2, "agent-2");

      // Agent-1 publishes
      bridge.publish({ type: "task:claimed", timestamp: new Date().toISOString(), payload: { by: "agent-1" } });

      // Agent-2 polls and receives
      const received: GraphEvent[] = [];
      bus2.on("task:claimed", (e) => received.push(e));

      bridge2.pollOnce();

      expect(received).toHaveLength(1);
      expect(received[0].payload.by).toBe("agent-1");

      bridge2.stopPolling();
    });
  });
});
