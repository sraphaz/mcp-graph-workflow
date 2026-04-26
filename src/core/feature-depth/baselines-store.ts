/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Thin DAO over the feature_depth_baselines table (migration v65).
 * Used by finish_task to compare current scores against prior runs
 * and by plan_sprint to weight task-readiness by file fragility.
 *
 * Non-blocking: every method swallows SQLite errors and falls back
 * to a sane default (null on get, no-op on upsert) so a baselines
 * issue never blocks a finish_task. Errors are logged.
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import type { Quadrant } from "./quadrant.js";

export interface BaselineRow {
  readonly relPath: string;
  readonly module: string;
  readonly score: number;
  readonly quadrant: Quadrant;
  readonly testLoc: number;
  readonly sourceLoc: number;
  readonly storedAt: string;
  readonly gitCommit: string | null;
}

export interface UpsertBaselineInput {
  readonly relPath: string;
  readonly module: string;
  readonly score: number;
  readonly quadrant: Quadrant;
  readonly testLoc: number;
  readonly sourceLoc: number;
  readonly gitCommit?: string | null;
}

function getProjectId(db: Database.Database): string | null {
  try {
    const row = db
      .prepare("SELECT id FROM projects LIMIT 1")
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** Read the prior baseline for a single file, or null if absent. */
export function getBaseline(
  db: Database.Database,
  relPath: string,
): BaselineRow | null {
  const projectId = getProjectId(db);
  if (!projectId) return null;

  try {
    const row = db
      .prepare(
        `SELECT rel_path, module, score, quadrant, test_loc, source_loc, stored_at, git_commit
         FROM feature_depth_baselines
         WHERE project_id = ? AND rel_path = ?`,
      )
      .get(projectId, relPath) as
      | {
          rel_path: string;
          module: string;
          score: number;
          quadrant: string;
          test_loc: number;
          source_loc: number;
          stored_at: string;
          git_commit: string | null;
        }
      | undefined;

    if (!row) return null;
    return {
      relPath: row.rel_path,
      module: row.module,
      score: row.score,
      quadrant: row.quadrant as Quadrant,
      testLoc: row.test_loc,
      sourceLoc: row.source_loc,
      storedAt: row.stored_at,
      gitCommit: row.git_commit,
    };
  } catch (err) {
    logger.warn("feature-depth:baseline-get-failed", {
      relPath,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** UPSERT — replaces any prior row for this (project, relPath). */
export function upsertBaseline(
  db: Database.Database,
  input: UpsertBaselineInput,
): void {
  const projectId = getProjectId(db);
  if (!projectId) return;

  try {
    db.prepare(
      `INSERT INTO feature_depth_baselines
        (project_id, rel_path, module, score, quadrant, test_loc, source_loc, stored_at, git_commit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, rel_path) DO UPDATE SET
         module      = excluded.module,
         score       = excluded.score,
         quadrant    = excluded.quadrant,
         test_loc    = excluded.test_loc,
         source_loc  = excluded.source_loc,
         stored_at   = excluded.stored_at,
         git_commit  = excluded.git_commit`,
    ).run(
      projectId,
      input.relPath,
      input.module,
      input.score,
      input.quadrant,
      input.testLoc,
      input.sourceLoc,
      new Date().toISOString(),
      input.gitCommit ?? null,
    );
  } catch (err) {
    logger.warn("feature-depth:baseline-upsert-failed", {
      relPath: input.relPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Read all baselines for a module — used by plan_sprint risk index. */
export function getBaselinesByModule(
  db: Database.Database,
  module: string,
): BaselineRow[] {
  const projectId = getProjectId(db);
  if (!projectId) return [];

  try {
    const rows = db
      .prepare(
        `SELECT rel_path, module, score, quadrant, test_loc, source_loc, stored_at, git_commit
         FROM feature_depth_baselines
         WHERE project_id = ? AND module = ?`,
      )
      .all(projectId, module) as Array<{
      rel_path: string;
      module: string;
      score: number;
      quadrant: string;
      test_loc: number;
      source_loc: number;
      stored_at: string;
      git_commit: string | null;
    }>;

    return rows.map((row) => ({
      relPath: row.rel_path,
      module: row.module,
      score: row.score,
      quadrant: row.quadrant as Quadrant,
      testLoc: row.test_loc,
      sourceLoc: row.source_loc,
      storedAt: row.stored_at,
      gitCommit: row.git_commit,
    }));
  } catch {
    return [];
  }
}
