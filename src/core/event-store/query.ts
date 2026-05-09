/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-unified-observability — Task 1.3: typed query API for event store.
 */

import type Database from "better-sqlite3";

export interface EventRow {
  id: string;
  kind: string;
  subjectRef_kind: string;
  subjectRef_id: string;
  sessionId: string | null;
  timestamp: string;
  durationMs: number | null;
  parentEventId: string | null;
  payload: string | null;
  projectId: string | null;
}

function pct(sorted: number[], p: number): number {
  const rank = p * sorted.length - 1;
  const lo = Math.max(0, Math.floor(rank));
  const hi = Math.min(Math.ceil(rank), sorted.length - 1);
  return Math.round(sorted[lo]! + (rank - lo) * (sorted[hi]! - sorted[lo]!));
}

export interface EventMetrics {
  count: number;
  p50: number;
  p95: number;
}

export function getEventsBySession(db: Database.Database, sessionId: string, limit: number): EventRow[] {
  return db
    .prepare("SELECT * FROM events WHERE sessionId = ? ORDER BY timestamp ASC LIMIT ?")
    .all(sessionId, limit) as EventRow[];
}

export function getEventsBySubject(db: Database.Database, kind: string, id: string): EventRow[] {
  return db
    .prepare("SELECT * FROM events WHERE subjectRef_kind = ? AND subjectRef_id = ? ORDER BY timestamp ASC")
    .all(kind, id) as EventRow[];
}

export function getMetrics(db: Database.Database, kind: string, windowMs: number): EventMetrics {
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = db
    .prepare("SELECT durationMs FROM events WHERE kind = ? AND timestamp >= ? AND durationMs IS NOT NULL ORDER BY durationMs ASC")
    .all(kind, since) as Array<{ durationMs: number }>;

  const count = rows.length;
  if (count === 0) return { count: 0, p50: 0, p95: 0 };

  const durations = rows.map((r) => r.durationMs);
  return { count, p50: pct(durations, 0.5), p95: pct(durations, 0.95) };
}

export function getCausalityChain(db: Database.Database, eventId: string): EventRow[] {
  return db
    .prepare(
      `WITH RECURSIVE chain(id, kind, subjectRef_kind, subjectRef_id, sessionId, timestamp,
          durationMs, parentEventId, payload, projectId) AS (
        SELECT id, kind, subjectRef_kind, subjectRef_id, sessionId, timestamp,
               durationMs, parentEventId, payload, projectId
        FROM events WHERE id = ?
        UNION ALL
        SELECT e.id, e.kind, e.subjectRef_kind, e.subjectRef_id, e.sessionId, e.timestamp,
               e.durationMs, e.parentEventId, e.payload, e.projectId
        FROM events e JOIN chain c ON e.id = c.parentEventId
      )
      SELECT * FROM chain`
    )
    .all(eventId) as EventRow[];
}
