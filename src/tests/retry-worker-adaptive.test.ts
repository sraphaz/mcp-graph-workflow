/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B2 — adaptive retry policy tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  RetryWorker,
  enqueueRetry,
  RECURRENT_PATTERN_THRESHOLD,
} from "../core/autonomy/retry-worker.js";

function seedTask(db: Database.Database, taskId: string): void {
  const now = "2026-04-29T00:00:00Z";
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, created_at, updated_at)
     VALUES ('p1', 'Test', '2026-01-01', '2026-01-01')`,
  ).run();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
     VALUES (?, 'p1', 'subtask', 'T', 'in_progress', 3, ?, ?)`,
  ).run(taskId, now, now);
}

describe("RetryWorker adaptive policy (E22.B2)", () => {
  let db: Database.Database;
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const emitEvent = (event: string, payload: Record<string, unknown>) => {
    events.push({ event, payload });
  };

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    events.length = 0;
  });

  afterEach(() => {
    db.close();
  });

  it("migration v78 creates lessons_learned table", () => {
    const cols = db
      .prepare("PRAGMA table_info(lessons_learned)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const c of [
      "id",
      "pattern_hash",
      "description",
      "recommended_action",
      "applied_count",
      "confidence",
    ]) {
      expect(names.has(c), `missing lessons_learned.${c}`).toBe(true);
    }
  });

  it("recurrent pattern (count > threshold) triggers early abandon + lesson + approval:required", async () => {
    seedTask(db, "task-1");
    seedTask(db, "task-2");
    seedTask(db, "task-3");
    const retryId1 = enqueueRetry(db, "task-1");
    const retryId2 = enqueueRetry(db, "task-2");
    const retryId3 = enqueueRetry(db, "task-3");

    db.prepare(
      `UPDATE retry_queue SET next_retry_ms = 0 WHERE id IN (?, ?, ?)`,
    ).run(retryId1, retryId2, retryId3);

    const worker = new RetryWorker(
      db,
      async () => {
        throw new Error("ECONNRESET network down");
      },
      { emitEvent },
    );

    // First batch: count goes 1 → 2 → 3 across 3 distinct tasks
    await worker.processBatch();

    const abandoned = db
      .prepare(`SELECT COUNT(*) AS n FROM retry_queue WHERE status = 'abandoned'`)
      .get() as { n: number };
    // 3rd retry has count > threshold (=2) → abandoned early
    expect(abandoned.n).toBeGreaterThanOrEqual(1);

    const lessons = db
      .prepare(`SELECT * FROM lessons_learned`)
      .all() as Array<{
      pattern_hash: string;
      recommended_action: string;
      description: string;
    }>;
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    expect(lessons[0].recommended_action).toBe("skip-similar");
    expect(lessons[0].description).toMatch(/network/i);

    const approvals = events.filter((e) => e.event === "approval:required");
    expect(approvals.length).toBeGreaterThanOrEqual(1);
    expect(approvals[0].payload.reason).toBe("recurrent_error_pattern");
    expect(approvals[0].payload.category).toBe("network");
  });

  it("non-recurrent error follows normal exponential backoff (no lesson, no approval)", async () => {
    seedTask(db, "task-1");
    const retryId = enqueueRetry(db, "task-1");
    db.prepare(`UPDATE retry_queue SET next_retry_ms = 0 WHERE id = ?`).run(retryId);

    const worker = new RetryWorker(
      db,
      async () => {
        throw new Error("ECONNRESET first time");
      },
      { emitEvent },
    );

    await worker.processBatch();

    const row = db
      .prepare(`SELECT status, attempt, next_retry_ms FROM retry_queue WHERE id = ?`)
      .get(retryId) as { status: string; attempt: number; next_retry_ms: number };
    expect(row.status).toBe("pending");
    expect(row.attempt).toBe(1);
    expect(row.next_retry_ms).toBeGreaterThan(Date.now());

    expect(events.filter((e) => e.event === "approval:required")).toHaveLength(0);
    const lessons = db.prepare(`SELECT COUNT(*) AS n FROM lessons_learned`).get() as { n: number };
    expect(lessons.n).toBe(0);
  });

  it("RECURRENT_PATTERN_THRESHOLD = 2 (3rd occurrence triggers escalation)", () => {
    expect(RECURRENT_PATTERN_THRESHOLD).toBe(2);
  });

  it("backward compat: distinct error messages do NOT escalate (different hashes)", async () => {
    seedTask(db, "task-1");
    seedTask(db, "task-2");
    seedTask(db, "task-3");
    const r1 = enqueueRetry(db, "task-1");
    const r2 = enqueueRetry(db, "task-2");
    const r3 = enqueueRetry(db, "task-3");
    db.prepare(`UPDATE retry_queue SET next_retry_ms = 0 WHERE id IN (?, ?, ?)`).run(r1, r2, r3);

    const errors = ["validation failed schema", "type error TS2322:", "cannot find module foo"];
    let i = 0;
    const worker = new RetryWorker(
      db,
      async () => {
        throw new Error(errors[i++ % errors.length]);
      },
      { emitEvent },
    );

    await worker.processBatch();

    const lessons = db.prepare(`SELECT COUNT(*) AS n FROM lessons_learned`).get() as { n: number };
    expect(lessons.n).toBe(0);
  });
});
