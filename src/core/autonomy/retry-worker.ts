/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A2 — RetryWorker.
 * Background loop que persiste falhas em retry_queue (v76 migration) e re-executa
 * com backoff exponencial. Wirado no daemon-entry.ts. Falhas que excedem
 * MAX_RETRY_ATTEMPTS são abandonadas + emitem 'error:retry_exhausted'.
 */

import type Database from "better-sqlite3";
import { createLogger } from "../utils/logger.js";
import { recordError } from "../utils/error-recorder.js";

const log = createLogger({ layer: "core", source: "retry-worker.ts" });

export const MAX_RETRY_ATTEMPTS = 5;
export const DEFAULT_INTERVAL_MS = 30_000;
/** §EPIC-22.B2 — recurrent pattern threshold: count>RECURRENT_PATTERN_THRESHOLD → abandon early. */
export const RECURRENT_PATTERN_THRESHOLD = 2;
const BATCH_SIZE = 10;

export type RetryExecutor = (taskId: string) => Promise<void>;
export type EventEmitter = (event: string, payload: Record<string, unknown>) => void;

export interface RetryWorkerOptions {
  emitEvent?: EventEmitter;
}

interface RetryRow {
  id: string;
  task_id: string;
  attempt: number;
  next_retry_ms: number;
  last_error: string | null;
  status: string;
}

export class RetryWorker {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly executor: RetryExecutor,
    private readonly opts: RetryWorkerOptions = {},
  ) {}

  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return; // already running
    this.timer = setInterval(() => {
      void this.processBatch().catch((err) => {
        log.error("retry-worker:tick-error", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, intervalMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processBatch(): Promise<void> {
    const now = Date.now();
    const rows = this.db
      .prepare(
        `SELECT id, task_id, attempt, next_retry_ms, last_error, status
         FROM retry_queue
         WHERE status = 'pending' AND next_retry_ms <= ?
         ORDER BY next_retry_ms ASC
         LIMIT ?`,
      )
      .all(now, BATCH_SIZE) as RetryRow[];

    for (const row of rows) {
      await this.processOne(row);
    }
  }

  private async processOne(row: RetryRow): Promise<void> {
    try {
      await this.executor(row.task_id);
      this.markDone(row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // §EPIC-22.B2 — record + classify; if pattern is recurrent, escalate.
      const pattern = recordError(this.db, err);
      if (pattern.count > RECURRENT_PATTERN_THRESHOLD) {
        this.abandonWithLesson(row, message, pattern.errorHash, pattern.category, pattern.count);
        return;
      }
      this.markFailedOrAbandoned(row, message);
    }
  }

  private abandonWithLesson(
    row: RetryRow,
    errorMessage: string,
    patternHash: string,
    category: string,
    count: number,
  ): void {
    const newAttempt = row.attempt + 1;
    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE retry_queue
         SET status = 'abandoned', attempt = ?, last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(newAttempt, errorMessage, nowIso, row.id);

    const lessonId = `lesson-${patternHash}-${Date.now()}`;
    const description = `Recurrent ${category} pattern (count=${count}) — escalated early`;
    this.db
      .prepare(
        `INSERT INTO lessons_learned
           (id, pattern_hash, description, recommended_action, applied_count, confidence, created_at, updated_at)
         VALUES (?, ?, ?, 'skip-similar', 1, 0.8, ?, ?)`,
      )
      .run(lessonId, patternHash, description, nowIso, nowIso);

    this.opts.emitEvent?.("approval:required", {
      reason: "recurrent_error_pattern",
      retryId: row.id,
      taskId: row.task_id,
      patternHash,
      category,
      patternCount: count,
      lastError: errorMessage,
    });
    log.warn("retry-worker:abandoned-recurrent", {
      retryId: row.id,
      taskId: row.task_id,
      patternHash,
      category,
      count,
    });
  }

  private markDone(retryId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE retry_queue SET status = 'done', updated_at = ? WHERE id = ?`)
      .run(now, retryId);
  }

  private markFailedOrAbandoned(row: RetryRow, errorMessage: string): void {
    const newAttempt = row.attempt + 1;
    const nowIso = new Date().toISOString();

    if (newAttempt >= MAX_RETRY_ATTEMPTS) {
      this.db
        .prepare(
          `UPDATE retry_queue
           SET status = 'abandoned', attempt = ?, last_error = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(newAttempt, errorMessage, nowIso, row.id);
      this.opts.emitEvent?.("error:retry_exhausted", {
        retryId: row.id,
        taskId: row.task_id,
        attempt: newAttempt,
        lastError: errorMessage,
      });
      log.warn("retry-worker:abandoned", {
        retryId: row.id,
        taskId: row.task_id,
        attempt: newAttempt,
      });
      return;
    }

    const backoffMs = Math.pow(2, newAttempt) * 1000;
    const nextRetryMs = Date.now() + backoffMs;
    this.db
      .prepare(
        `UPDATE retry_queue
         SET attempt = ?, next_retry_ms = ?, last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(newAttempt, nextRetryMs, errorMessage, nowIso, row.id);
  }
}

/** Helper: enqueue a task into retry_queue. Used by EventReactor (E22.A4). */
export function enqueueRetry(
  db: Database.Database,
  taskId: string,
  errorMessage?: string,
): string {
  const id = `retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO retry_queue (id, task_id, attempt, next_retry_ms, last_error, status, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, 'pending', ?, ?)`,
  ).run(id, taskId, Date.now() + 1000, errorMessage ?? null, now, now);
  return id;
}
