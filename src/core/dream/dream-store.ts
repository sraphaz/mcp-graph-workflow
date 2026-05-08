/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import type Database from "better-sqlite3";
import type { DreamCycleResult } from "./dream-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "dream-store.ts" });

// ─── Archive entry shape ───

export interface DreamArchiveEntry {
  id: string;
  originalDocId: string;
  title: string;
  sourceType: string;
  qualityScore: number | null;
  reason: "pruned" | "merged" | "archived";
  archivedAt: string;
  cycleId: string;
}

// ─── Row types (SQLite) ───

interface CycleRow {
  id: string;
  status: string;
  config: string;
  result: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface ArchiveRow {
  id: string;
  original_doc_id: string;
  title: string;
  source_type: string;
  quality_score: number | null;
  reason: string;
  archived_at: string;
  cycle_id: string;
}

// ─── Save a new dream cycle ───

/** Persist a new dream cycle result to the database. */
export function saveDreamCycle(db: Database.Database, cycle: DreamCycleResult): void {
  const stmt = db.prepare(`
    INSERT INTO dream_cycles (id, status, config, result, started_at, completed_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    cycle.id,
    cycle.status,
    JSON.stringify(cycle.config),
    JSON.stringify({ phases: cycle.phases, summary: cycle.summary }),
    cycle.startedAt,
    cycle.completedAt || null,
    null,
  );
  log.debug("dream-store:save", { cycleId: cycle.id, status: cycle.status });
}

// ─── Update an existing dream cycle ───

/** Update an existing dream cycle's status, result, and completion timestamp. */
export function updateDreamCycle(db: Database.Database, cycle: DreamCycleResult): void {
  const stmt = db.prepare(`
    UPDATE dream_cycles
    SET status = ?, result = ?, completed_at = ?, error_message = ?
    WHERE id = ?
  `);
  stmt.run(
    cycle.status,
    JSON.stringify({ phases: cycle.phases, summary: cycle.summary }),
    cycle.completedAt || null,
    null,
    cycle.id,
  );
  log.debug("dream-store:update", { cycleId: cycle.id, status: cycle.status });
}

// ─── Get a single dream cycle by ID ───

/** Retrieve a single dream cycle by its ID, or null if not found. */
export function getDreamCycle(db: Database.Database, id: string): DreamCycleResult | null {
  const row = db.prepare("SELECT * FROM dream_cycles WHERE id = ?").get(id) as CycleRow | undefined;
  if (!row) return null;
  return rowToCycleResult(row);
}

// ─── List dream cycles (most recent first) ───

/** List dream cycles ordered by most recent first, up to the given limit. */
export function listDreamCycles(db: Database.Database, limit: number = 50): DreamCycleResult[] {
  const rows = db
    .prepare("SELECT * FROM dream_cycles ORDER BY started_at DESC LIMIT ?")
    .all(limit) as CycleRow[];
  return rows.map(rowToCycleResult);
}

// ─── Archive a document (soft-delete tracking) ───

/** Archive a knowledge document that was pruned or merged during a dream cycle. */
export function archiveDreamDoc(db: Database.Database, entry: DreamArchiveEntry): void {
  const stmt = db.prepare(`
    INSERT INTO dream_archive (id, original_doc_id, title, source_type, quality_score, reason, archived_at, cycle_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    entry.id,
    entry.originalDocId,
    entry.title,
    entry.sourceType,
    entry.qualityScore,
    entry.reason,
    entry.archivedAt,
    entry.cycleId,
  );
  log.debug("dream-store:archive", { docId: entry.originalDocId, reason: entry.reason });
}

// ─── List archived docs for a cycle ───

/** List all archived documents for a specific dream cycle. */
export function listDreamArchive(db: Database.Database, cycleId: string): DreamArchiveEntry[] {
  const rows = db
    .prepare("SELECT * FROM dream_archive WHERE cycle_id = ? ORDER BY archived_at ASC")
    .all(cycleId) as ArchiveRow[];
  return rows.map(rowToArchiveEntry);
}

// ─── Internal converters ───

function rowToCycleResult(row: CycleRow): DreamCycleResult {
  const config = JSON.parse(row.config) as DreamCycleResult["config"];
  const resultData = row.result ? JSON.parse(row.result) as { phases: DreamCycleResult["phases"]; summary: DreamCycleResult["summary"] } : null;
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? "",
    status: row.status as DreamCycleResult["status"],
    config,
    phases: resultData?.phases ?? {
      nrem: { replayed: 0, scoresDecayed: 0, pruned: 0, archived: 0, durationMs: 0 },
      rem: { priorityProcessed: 0, urgencyDecayed: 0, merged: 0, clustersFormed: 0, associationsCreated: 0, durationMs: 0 },
      wakeReady: { freedTokens: 0, signalToNoise: 0, newGeneralizations: 0, durationMs: 0 },
    },
    summary: resultData?.summary ?? {
      totalDocsBefore: 0, totalDocsAfter: 0,
      avgQualityBefore: 0, avgQualityAfter: 0,
      totalPruned: 0, totalMerged: 0,
      totalAssociations: 0, freedCapacityEstimate: 0,
    },
  };
}

function rowToArchiveEntry(row: ArchiveRow): DreamArchiveEntry {
  return {
    id: row.id,
    originalDocId: row.original_doc_id,
    title: row.title,
    sourceType: row.source_type,
    qualityScore: row.quality_score,
    reason: row.reason as DreamArchiveEntry["reason"],
    archivedAt: row.archived_at,
    cycleId: row.cycle_id,
  };
}
