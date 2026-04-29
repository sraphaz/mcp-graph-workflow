/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-23.T03 — LISTENING phase feedback closure.
 *
 * A decision becomes "stale" when its row in the `decisions` table has
 * NULL outcome (success column null) AND was created more than
 * `staleAfterMs` ago (default 7 days). This sweep produces the count +
 * IDs so the LISTENING phase of `prd_lifecycle_health` can decide whether
 * the feedback loop closed in time.
 */

import type Database from "better-sqlite3";

export interface ListeningSweepResult {
  /** Total decisions checked. */
  totalChecked: number;
  /** Count of decisions with outcome registered (success != NULL). */
  closedCount: number;
  /** Stale decisions = no outcome AND created > staleAfterMs ago. */
  staleCount: number;
  /** IDs of stale decisions (for downstream actions). */
  staleIds: string[];
  /** Closure rate: closedCount / totalChecked (1.0 when totalChecked=0). */
  closureRate: number;
}

export const DEFAULT_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Pure function — given a db connection and "now" timestamp, sweep the
 * decisions table and return the closure metrics.
 *
 * @param db SQLite connection (must have decisions table — migration v80).
 * @param now Reference timestamp ms (caller supplies for determinism).
 * @param staleAfterMs Threshold; default 7 days.
 */
export function sweepStaleDecisions(
  db: Database.Database,
  now: number = Date.now(),
  staleAfterMs: number = DEFAULT_STALE_AFTER_MS,
): ListeningSweepResult {
  const rows = db
    .prepare(`SELECT id, success, created_at FROM decisions`)
    .all() as Array<{ id: string; success: number | null; created_at: string }>;

  const totalChecked = rows.length;
  let closedCount = 0;
  const staleIds: string[] = [];

  const cutoffMs = now - staleAfterMs;
  for (const row of rows) {
    if (row.success !== null) {
      closedCount++;
      continue;
    }
    const createdMs = new Date(row.created_at).getTime();
    if (createdMs <= cutoffMs) {
      staleIds.push(row.id);
    }
  }

  const closureRate =
    totalChecked === 0 ? 1 : closedCount / totalChecked;

  return {
    totalChecked,
    closedCount,
    staleCount: staleIds.length,
    staleIds,
    closureRate: Number(closureRate.toFixed(3)),
  };
}
