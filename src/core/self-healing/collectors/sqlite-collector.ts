/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: collector source=sqlite
 *
 * Enqueues a FailureSignal on typed SQLite errors (BUSY, LOCKED, corruption).
 * Severity: "error" for lock/busy, "warn" for other DB errors.
 */

import type { FailureSignalCollector } from "../failure-signal-collector.js";

const SQLITE_ERROR_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED", "SQLITE_CORRUPT", "SQLITE_IOERR"]);

export function collectSqliteError(err: Error, collector: FailureSignalCollector): void {
  const code = (err as { code?: string }).code;
  const signalKind = code && SQLITE_ERROR_CODES.has(code) ? code : "SQLITE_ERROR";
  const severity = code === "SQLITE_BUSY" || code === "SQLITE_LOCKED" ? "error" : "warn";
  collector.record({
    source: "sqlite",
    signalKind,
    context: {},
    severity,
    timestamp: new Date().toISOString(),
    rawError: err.message,
  });
}
