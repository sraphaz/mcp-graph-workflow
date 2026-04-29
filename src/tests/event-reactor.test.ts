/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A4 — EventReactor tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { EventReactor, EVENT_HANDLERS } from "../core/autonomy/event-reactor.js";

interface SimpleBus {
  handlers: Map<string, Array<(payload: unknown) => void | Promise<void>>>;
  on(event: string, handler: (payload: unknown) => void | Promise<void>): void;
  emit(event: string, payload: unknown): Promise<void>;
}

function makeBus(): SimpleBus {
  const handlers = new Map<string, Array<(payload: unknown) => void | Promise<void>>>();
  return {
    handlers,
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    },
    async emit(event, payload) {
      const list = handlers.get(event) ?? [];
      for (const h of list) await h(payload);
    },
  };
}

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    `INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'T', '2026-01-01', '2026-01-01')`,
  ).run();
  const now = "2026-04-29T00:00:00Z";
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
     VALUES ('n1', 'p1', 'subtask', 'Task', 'in_progress', 3, ?, ?)`,
  ).run(now, now);
  return db;
}

describe("EVENT_HANDLERS list (E22.A4)", () => {
  it("registers exactly 5 critical events", () => {
    expect(EVENT_HANDLERS).toEqual([
      "cost:budget_exceeded",
      "error:retry_exhausted",
      "session:start",
      "task:error",
      "harness:regression",
    ]);
  });
});

describe("EventReactor (E22.A4)", () => {
  let db: Database.Database;
  let bus: SimpleBus;
  let originalPaused: string | undefined;

  beforeEach(() => {
    db = setupDb();
    bus = makeBus();
    originalPaused = process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
    delete process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
  });

  afterEach(() => {
    db.close();
    if (originalPaused === undefined) delete process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
    else process.env.MCP_GRAPH_AUTOPILOT_PAUSED = originalPaused;
  });

  it("register(bus, db) subscribes on all 5 events", () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    for (const event of EVENT_HANDLERS) {
      expect(bus.handlers.has(event), `missing handler for ${event}`).toBe(true);
    }
  });

  it("cost:budget_exceeded sets MCP_GRAPH_AUTOPILOT_PAUSED=true", async () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    await bus.emit("cost:budget_exceeded", { runId: "r1", totalUsd: 1.5, capUsd: 1.0 });
    expect(process.env.MCP_GRAPH_AUTOPILOT_PAUSED).toBe("true");
  });

  it("error:retry_exhausted re-emits approval:required", async () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    const approvalEvents: unknown[] = [];
    bus.on("approval:required", (p) => approvalEvents.push(p));

    await bus.emit("error:retry_exhausted", {
      retryId: "r1",
      taskId: "n1",
      lastError: "boom",
    });

    expect(approvalEvents.length).toBe(1);
    expect(approvalEvents[0]).toMatchObject({ nodeId: "n1", reason: expect.stringMatching(/retry/i) });
  });

  it("task:error enqueues row in retry_queue", async () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    await bus.emit("task:error", { nodeId: "n1", error: "transient" });

    const rows = db.prepare(`SELECT * FROM retry_queue WHERE task_id = 'n1'`).all();
    expect(rows.length).toBe(1);
  });

  it("harness:regression with delta < -10 pauses autopilot", async () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    await bus.emit("harness:regression", { delta: -15, scoreBefore: 80, scoreAfter: 65 });
    expect(process.env.MCP_GRAPH_AUTOPILOT_PAUSED).toBe("true");
  });

  it("harness:regression with delta >= -10 does NOT pause autopilot", async () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    await bus.emit("harness:regression", { delta: -5, scoreBefore: 80, scoreAfter: 75 });
    expect(process.env.MCP_GRAPH_AUTOPILOT_PAUSED).toBeUndefined();
  });

  it("session:start no-op when no last_session_ts in project_settings", async () => {
    const reactor = new EventReactor(db, bus);
    reactor.register();
    // Should not throw even with no prior session.
    await expect(bus.emit("session:start", {})).resolves.not.toThrow();
  });

  it("handler errors do not throw out of emit (advisory only)", async () => {
    // Make an existing test resilient: even if db gets closed mid-handler, no throw escapes.
    const reactor = new EventReactor(db, bus);
    reactor.register();
    // Emit an event with malformed payload - handler should swallow.
    await expect(bus.emit("task:error", null)).resolves.not.toThrow();
  });
});
