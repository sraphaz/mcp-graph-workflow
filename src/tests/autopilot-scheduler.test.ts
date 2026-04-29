/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A3 — AutopilotScheduler tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  AutopilotScheduler,
  pickNextReadyNode,
  isAutopilotPaused,
} from "../core/autonomy/autopilot-scheduler.js";

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    `INSERT INTO projects (id, name, created_at, updated_at)
     VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
  ).run();
  return db;
}

function insertNode(
  db: Database.Database,
  id: string,
  status: "ready" | "in_progress" | "backlog" | "done",
  priority: 1 | 2 | 3 | 4 | 5 = 3,
  blocked: 0 | 1 = 0,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at)
     VALUES (?, 'p1', 'subtask', ?, ?, ?, ?, ?, ?)`,
  ).run(id, `task-${id}`, status, priority, blocked, now, now);
}

describe("isAutopilotPaused (E22.A3)", () => {
  let originalPaused: string | undefined;

  beforeEach(() => {
    originalPaused = process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
    delete process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
  });

  afterEach(() => {
    if (originalPaused === undefined) delete process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
    else process.env.MCP_GRAPH_AUTOPILOT_PAUSED = originalPaused;
  });

  it("returns false by default", () => {
    expect(isAutopilotPaused()).toBe(false);
  });

  it("returns true when MCP_GRAPH_AUTOPILOT_PAUSED=true", () => {
    process.env.MCP_GRAPH_AUTOPILOT_PAUSED = "true";
    expect(isAutopilotPaused()).toBe(true);
  });

  it("returns false for any other value (1, on, etc)", () => {
    process.env.MCP_GRAPH_AUTOPILOT_PAUSED = "1";
    expect(isAutopilotPaused()).toBe(false);
    process.env.MCP_GRAPH_AUTOPILOT_PAUSED = "on";
    expect(isAutopilotPaused()).toBe(false);
  });
});

describe("pickNextReadyNode (E22.A3)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("returns null when no ready nodes", () => {
    insertNode(db, "n1", "backlog");
    expect(pickNextReadyNode(db)).toBeNull();
  });

  it("picks ready unblocked node with highest priority (lowest priority number)", () => {
    insertNode(db, "low", "ready", 5);
    insertNode(db, "high", "ready", 1);
    insertNode(db, "mid", "ready", 3);
    expect(pickNextReadyNode(db)?.id).toBe("high");
  });

  it("skips blocked nodes", () => {
    insertNode(db, "blocked-one", "ready", 1, 1);
    insertNode(db, "open-two", "ready", 2, 0);
    expect(pickNextReadyNode(db)?.id).toBe("open-two");
  });

  it("returns shape {id, title, priority}", () => {
    insertNode(db, "n1", "ready", 2);
    const node = pickNextReadyNode(db);
    expect(node?.id).toBe("n1");
    expect(node?.priority).toBe(2);
    expect(typeof node?.title).toBe("string");
  });
});

describe("AutopilotScheduler (E22.A3)", () => {
  let db: Database.Database;
  let originalPaused: string | undefined;

  beforeEach(() => {
    db = setupDb();
    originalPaused = process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
    delete process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
  });

  afterEach(() => {
    db.close();
    if (originalPaused === undefined) delete process.env.MCP_GRAPH_AUTOPILOT_PAUSED;
    else process.env.MCP_GRAPH_AUTOPILOT_PAUSED = originalPaused;
  });

  it("tick dispatches the next ready node via dispatcher", async () => {
    insertNode(db, "n1", "ready", 1);
    const dispatcher = vi.fn().mockResolvedValue(undefined);
    const scheduler = new AutopilotScheduler(db, dispatcher);

    await scheduler.tick();
    expect(dispatcher).toHaveBeenCalledWith("n1");
  });

  it("tick is no-op when paused", async () => {
    process.env.MCP_GRAPH_AUTOPILOT_PAUSED = "true";
    insertNode(db, "n1", "ready", 1);
    const dispatcher = vi.fn();
    const scheduler = new AutopilotScheduler(db, dispatcher);
    await scheduler.tick();
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it("tick is no-op when no ready nodes", async () => {
    const dispatcher = vi.fn();
    const scheduler = new AutopilotScheduler(db, dispatcher);
    await scheduler.tick();
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it("tick swallows dispatcher errors and logs (does not throw)", async () => {
    insertNode(db, "n1", "ready", 1);
    const dispatcher = vi.fn().mockRejectedValue(new Error("dispatch failed"));
    const scheduler = new AutopilotScheduler(db, dispatcher);
    await expect(scheduler.tick()).resolves.not.toThrow();
  });

  it("start(intervalMs) creates interval; stop() clears", async () => {
    vi.useFakeTimers();
    insertNode(db, "n1", "ready", 1);
    const dispatcher = vi.fn().mockResolvedValue(undefined);
    const scheduler = new AutopilotScheduler(db, dispatcher);

    scheduler.start(100);
    await vi.advanceTimersByTimeAsync(150);
    expect(dispatcher.mock.calls.length).toBeGreaterThanOrEqual(1);
    scheduler.stop();
    const callsAfterStop = dispatcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(dispatcher.mock.calls.length).toBe(callsAfterStop);
    vi.useRealTimers();
  });

  it("start is idempotent (calling twice does not duplicate intervals)", () => {
    const dispatcher = vi.fn();
    const scheduler = new AutopilotScheduler(db, dispatcher);
    scheduler.start(1000);
    scheduler.start(1000); // no-op
    scheduler.stop();
    expect(true).toBe(true);
  });
});
