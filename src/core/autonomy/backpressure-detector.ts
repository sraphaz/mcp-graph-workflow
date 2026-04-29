/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C2 — Backpressure detector.
 * Pure check: WIP < capacity. AutopilotScheduler consulta antes de promover
 * task para in_progress. Sob backpressure, scheduler pula tick e mantém
 * tasks em ready (não enfileira indefinidamente).
 */

import type Database from "better-sqlite3";

export interface BackpressureState {
  wip: number;
  capacity: number;
  blocked: boolean;
}

export function getCurrentWip(db: Database.Database): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE status = 'in_progress'`)
    .get() as { n: number };
  return row.n;
}

export function checkBackpressure(
  db: Database.Database,
  capacity: number,
): BackpressureState {
  const wip = getCurrentWip(db);
  return { wip, capacity, blocked: wip >= capacity };
}
