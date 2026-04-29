/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { logger } from "./logger.js";

/** Queries taking longer than this are logged as warnings. */
export const SLOW_QUERY_THRESHOLD_MS = 500;

/** Max SQL characters included in the slow query log entry. */
const MAX_SQL_LOG_CHARS = 200;

interface TimedQueryOptions {
  /** Injectable clock — defaults to Date.now(). */
  nowFn?: () => number;
  /** Override the threshold for testing. */
  thresholdMs?: number;
}

/**
 * Execute `fn` and log a warning if it takes longer than `thresholdMs`.
 * Re-throws errors from `fn` unchanged.
 */
export function timedQuery<T>(sql: string, fn: () => T, opts: TimedQueryOptions = {}): T {
  const now = opts.nowFn ?? Date.now;
  const threshold = opts.thresholdMs ?? SLOW_QUERY_THRESHOLD_MS;
  const t0 = now();
  try {
    return fn();
  } finally {
    const durationMs = now() - t0;
    if (durationMs >= threshold) {
      logger.warn("slow_query", {
        sql: sql.slice(0, MAX_SQL_LOG_CHARS),
        durationMs,
      });
    }
  }
}
