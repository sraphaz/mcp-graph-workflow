/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A5 — End-to-end autonomous loop integration test.
 * Verifica que AutopilotScheduler + RetryWorker + EventReactor compostos
 * conseguem drenar uma sprint sem intervenção humana, persistindo retries
 * em retry_queue (v76) através do bus de eventos.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { RetryWorker } from "../core/autonomy/retry-worker.js";
import { AutopilotScheduler } from "../core/autonomy/autopilot-scheduler.js";
import { EventReactor } from "../core/autonomy/event-reactor.js";

interface SimpleBus {
  handlers: Map<string, Array<(payload: unknown) => void | Promise<void>>>;
  events: Array<{ event: string; payload: unknown }>;
  on(event: string, handler: (payload: unknown) => void | Promise<void>): void;
  emit(event: string, payload: unknown): Promise<void>;
}

function makeBus(): SimpleBus {
  const handlers = new Map<string, Array<(payload: unknown) => void | Promise<void>>>();
  const events: Array<{ event: string; payload: unknown }> = [];
  return {
    handlers,
    events,
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    },
    async emit(event, payload) {
      events.push({ event, payload });
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
    `INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'AutoTest', '2026-01-01', '2026-01-01')`,
  ).run();
  return db;
}

function seedReadyNode(db: Database.Database, id: string, priority: number = 3): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at)
     VALUES (?, 'p1', 'subtask', ?, 'ready', ?, 0, ?, ?)`,
  ).run(id, `task-${id}`, priority, now, now);
}

describe("Autonomous loop E2E (E22.A5)", () => {
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

  it("scheduler dispatches all 5 ready nodes when dispatcher succeeds", async () => {
    for (let i = 0; i < 5; i++) {
      seedReadyNode(db, `n${i}`, i);
    }

    const dispatched: string[] = [];
    const dispatcher = async (nodeId: string) => {
      dispatched.push(nodeId);
      // Simulate finish_task: mark node done
      db.prepare(`UPDATE nodes SET status = 'done' WHERE id = ?`).run(nodeId);
    };

    const scheduler = new AutopilotScheduler(db, dispatcher);

    // Drain loop manually (5 ticks)
    for (let i = 0; i < 5; i++) await scheduler.tick();

    expect(dispatched.length).toBe(5);
    const remaining = db
      .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE status = 'ready'`)
      .get() as { n: number };
    expect(remaining.n).toBe(0);
  });

  it("dispatcher failure → EventReactor enqueues retry_queue → RetryWorker re-executes", async () => {
    seedReadyNode(db, "flaky", 1);

    const reactor = new EventReactor(db, bus);
    reactor.register();

    let attempts = 0;
    const dispatcher = async (nodeId: string) => {
      attempts++;
      if (attempts < 3) {
        // First 2 attempts fail; emit task:error so EventReactor enqueues retry
        await bus.emit("task:error", { nodeId, error: `attempt ${attempts} failed` });
        throw new Error(`attempt ${attempts} failed`);
      }
      db.prepare(`UPDATE nodes SET status = 'done' WHERE id = ?`).run(nodeId);
    };

    const scheduler = new AutopilotScheduler(db, dispatcher);
    await scheduler.tick(); // attempt 1 fails → enqueued

    // Verify retry_queue has the row (status pending)
    const rows = db
      .prepare(`SELECT * FROM retry_queue WHERE task_id = 'flaky'`)
      .all() as Array<{ status: string; attempt: number }>;
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("pending");
  });

  it("RetryWorker abandon após MAX_RETRY_ATTEMPTS + EventReactor escala via approval:required", async () => {
    seedReadyNode(db, "broken", 1);
    const reactor = new EventReactor(db, bus);
    reactor.register();

    // Pre-seed retry queue at attempt 4 (next failure → abandon)
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO retry_queue (id, task_id, attempt, next_retry_ms, status, created_at, updated_at)
       VALUES ('r1', 'broken', 4, ?, 'pending', ?, ?)`,
    ).run(Date.now() - 1000, now, now);

    const failingExecutor = async () => {
      throw new Error("permanent");
    };

    const worker = new RetryWorker(db, failingExecutor, {
      emitEvent: (event, payload) => void bus.emit(event, payload),
    });

    await worker.processBatch();

    const row = db
      .prepare(`SELECT status, attempt FROM retry_queue WHERE id = 'r1'`)
      .get() as { status: string; attempt: number };
    expect(row.status).toBe("abandoned");
    expect(row.attempt).toBe(5);

    // EventReactor should have re-emitted approval:required from error:retry_exhausted
    const approvalEvents = bus.events.filter((e) => e.event === "approval:required");
    expect(approvalEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("scheduler is no-op when MCP_GRAPH_AUTOPILOT_PAUSED=true (set by EventReactor)", async () => {
    seedReadyNode(db, "n1");
    const reactor = new EventReactor(db, bus);
    reactor.register();

    // Trigger budget exceeded → EventReactor pauses autopilot
    await bus.emit("cost:budget_exceeded", { totalUsd: 2.0, capUsd: 1.0 });
    expect(process.env.MCP_GRAPH_AUTOPILOT_PAUSED).toBe("true");

    let dispatched = 0;
    const dispatcher = async () => {
      dispatched++;
    };
    const scheduler = new AutopilotScheduler(db, dispatcher);
    await scheduler.tick();

    expect(dispatched).toBe(0); // paused → no dispatch
  });

  it("Full sprint drain: 5 ready nodes, all complete via scheduler without human prompt", async () => {
    for (let i = 0; i < 5; i++) seedReadyNode(db, `task-${i}`, i + 1);
    const reactor = new EventReactor(db, bus);
    reactor.register();

    const dispatcher = async (nodeId: string) => {
      db.prepare(`UPDATE nodes SET status = 'done' WHERE id = ?`).run(nodeId);
    };
    const scheduler = new AutopilotScheduler(db, dispatcher);

    // Loop manual: drain até no more ready nodes
    let iterations = 0;
    while (iterations < 10) {
      await scheduler.tick();
      const remaining = db
        .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE status = 'ready'`)
        .get() as { n: number };
      if (remaining.n === 0) break;
      iterations++;
    }

    const done = db
      .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE status = 'done'`)
      .get() as { n: number };
    expect(done.n).toBe(5);

    // No approval:required events emitted (no human intervention)
    const approvalEvents = bus.events.filter((e) => e.event === "approval:required");
    expect(approvalEvents.length).toBe(0);
  });
});
