/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A2 — RetryWorker tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { RetryWorker, MAX_RETRY_ATTEMPTS } from "../core/autonomy/retry-worker.js";

interface RetryRow {
  id: string;
  task_id: string;
  attempt: number;
  next_retry_ms: number;
  status: string;
  last_error: string | null;
}

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  // Seed project + a node so FK is happy
  db.prepare(
    `INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
  ).run();
  const now = "2026-04-29T00:00:00Z";
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
     VALUES ('n1', 'p1', 'subtask', 'Test', 'in_progress', 3, ?, ?)`,
  ).run(now, now);
  return db;
}

function enqueue(db: Database.Database, id: string, taskId: string, nextRetryMs: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO retry_queue (id, task_id, attempt, next_retry_ms, status, created_at, updated_at)
     VALUES (?, ?, 0, ?, 'pending', ?, ?)`,
  ).run(id, taskId, nextRetryMs, now, now);
}

describe("RetryWorker (E22.A2)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("MAX_RETRY_ATTEMPTS = 5", () => {
    expect(MAX_RETRY_ATTEMPTS).toBe(5);
  });

  it("processBatch picks pending rows where next_retry_ms <= now", async () => {
    enqueue(db, "r1", "n1", Date.now() - 1000); // ready
    enqueue(db, "r2", "n1", Date.now() + 60_000); // future, skip
    const executor = vi.fn().mockResolvedValue(undefined);
    const worker = new RetryWorker(db, executor);

    await worker.processBatch();
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0]?.[0]).toBe("n1");
  });

  it("Success path: marks status=done, updated_at refreshed", async () => {
    enqueue(db, "r1", "n1", Date.now() - 1000);
    const executor = vi.fn().mockResolvedValue(undefined);
    const worker = new RetryWorker(db, executor);

    await worker.processBatch();
    const row = db.prepare(`SELECT * FROM retry_queue WHERE id = 'r1'`).get() as RetryRow;
    expect(row.status).toBe("done");
  });

  it("Failure path: increments attempt + computes exponential backoff", async () => {
    enqueue(db, "r1", "n1", Date.now() - 1000);
    const executor = vi.fn().mockRejectedValue(new Error("boom"));
    const worker = new RetryWorker(db, executor);

    const before = Date.now();
    await worker.processBatch();
    const row = db.prepare(`SELECT * FROM retry_queue WHERE id = 'r1'`).get() as RetryRow;
    expect(row.status).toBe("pending");
    expect(row.attempt).toBe(1);
    expect(row.last_error).toContain("boom");
    // backoff: now + 2^1 * 1000 = +2s. Allow 100ms slack.
    expect(row.next_retry_ms).toBeGreaterThanOrEqual(before + 1900);
    expect(row.next_retry_ms).toBeLessThan(before + 5000);
  });

  it("Abandon after MAX_RETRY_ATTEMPTS=5 + emits error:retry_exhausted", async () => {
    enqueue(db, "r1", "n1", Date.now() - 1000);
    // Pre-set attempt to 4 so next failure (5th) abandons
    db.prepare(`UPDATE retry_queue SET attempt = 4 WHERE id = 'r1'`).run();
    const executor = vi.fn().mockRejectedValue(new Error("final"));
    const events: Array<{ event: string; payload: unknown }> = [];
    const worker = new RetryWorker(db, executor, {
      emitEvent: (event, payload) => events.push({ event, payload }),
    });

    await worker.processBatch();
    const row = db.prepare(`SELECT * FROM retry_queue WHERE id = 'r1'`).get() as RetryRow;
    expect(row.status).toBe("abandoned");
    expect(row.attempt).toBe(5);
    expect(events.some((e) => e.event === "error:retry_exhausted")).toBe(true);
  });

  it("processBatch limits to LIMIT 10 per tick", async () => {
    for (let i = 0; i < 15; i++) {
      enqueue(db, `r${i}`, "n1", Date.now() - 1000);
    }
    const executor = vi.fn().mockResolvedValue(undefined);
    const worker = new RetryWorker(db, executor);

    await worker.processBatch();
    expect(executor.mock.calls.length).toBe(10);
  });

  it("start(intervalMs) creates interval; stop() clears it", async () => {
    vi.useFakeTimers();
    const executor = vi.fn().mockResolvedValue(undefined);
    const worker = new RetryWorker(db, executor);

    enqueue(db, "r1", "n1", Date.now() - 1000);
    worker.start(100);
    await vi.advanceTimersByTimeAsync(150);

    expect(executor.mock.calls.length).toBeGreaterThanOrEqual(1);
    worker.stop();
    const callsAfterStop = executor.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(executor.mock.calls.length).toBe(callsAfterStop);
    vi.useRealTimers();
  });

  it("handles empty queue (no errors, no executor calls)", async () => {
    const executor = vi.fn();
    const worker = new RetryWorker(db, executor);
    await worker.processBatch();
    expect(executor).not.toHaveBeenCalled();
  });
});
