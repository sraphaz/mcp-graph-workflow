/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: Hooks de coleta nas 5 fontes
 *
 * FailureSignalCollector — non-blocking write queue for failure_signals table.
 * record() is synchronous and O(1) — pushes to an in-memory array.
 * flush() drains the queue in a single SQLite transaction.
 * start(intervalMs) arms a periodic flush (default 5 000 ms per AC4).
 */

import type Database from "better-sqlite3";
import type { FailureSignal } from "../../schemas/failure-signal.schema.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "failure-signal-collector.ts" });

export type { FailureSignal };

export class FailureSignalCollector {
  private readonly db: Database.Database;
  private queue: FailureSignal[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Enqueue a signal without touching the DB. Never throws. */
  record(signal: FailureSignal): void {
    this.queue.push(signal);
  }

  /** Drain the queue into failure_signals in one transaction. */
  flush(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const insert = this.db.prepare(
      `INSERT INTO failure_signals (source, signalKind, context, severity, timestamp, rawError)
       VALUES (@source, @signalKind, @context, @severity, @timestamp, @rawError)`,
    );
    this.db.transaction(() => {
      for (const s of batch) {
        insert.run({
          source: s.source,
          signalKind: s.signalKind,
          context: JSON.stringify(s.context),
          severity: s.severity,
          timestamp: s.timestamp,
          rawError: s.rawError ?? null,
        });
      }
    })();
  }

  /** Start a periodic flush. Call once on boot. */
  start(intervalMs = 5_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try { this.flush(); } catch (e) { log.debug("intentional swallow", { error: e, reason: "never crash the caller on flush" }); }
    }, intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  /** Cancel the timer and flush any remaining signals. */
  shutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try { this.flush(); } catch (e) { log.debug("intentional swallow", { error: e, reason: "best-effort flush on timer shutdown" }); }
  }
}
