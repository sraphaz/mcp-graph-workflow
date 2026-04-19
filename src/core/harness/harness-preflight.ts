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

/**
 * Harness Preflight Warning — advisory quality signal for start_task.
 *
 * Reads the most recent harness_history snapshot and returns a warning
 * if the project's harnessability score is below grade B (< 70).
 * Non-blocking: returns null on any error or missing data.
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export interface HarnessPreflightWarning {
  score: number;
  grade: string;
  message: string;
}

/**
 * Get a pre-flight harness warning based on the most recent scan result.
 * Returns null if score >= 70 (grade A/B), no history, or any error.
 */
export function getHarnessPreflightWarning(db: Database.Database): HarnessPreflightWarning | null {
  try {
    const row = db
      .prepare(
        "SELECT score, grade FROM harness_history ORDER BY timestamp DESC LIMIT 1",
      )
      .get() as { score: number; grade: string } | undefined;

    if (!row) return null;

    if (row.score >= 70) return null;

    const message = row.score < 55
      ? `High hallucination risk — grade ${row.grade} (score ${row.score}). Extra caution recommended.`
      : `Moderate quality gap — grade ${row.grade} (score ${row.score}). Exercise caution with inferences.`;

    return {
      score: row.score,
      grade: row.grade,
      message,
    };
  } catch (err) {
    logger.warn("harness:preflight:error", { error: String(err) });
    return null;
  }
}

export interface HarnessRegressionReport {
  before: number;
  after: number;
  delta: number;
}

/**
 * Compare current harness score with the previous snapshot.
 * Returns regression report if score dropped > 5 points, null otherwise.
 */
export function getHarnessRegressionReport(
  db: Database.Database,
  currentScore: number,
): HarnessRegressionReport | null {
  try {
    const rows = db
      .prepare(
        "SELECT score FROM harness_history ORDER BY timestamp DESC LIMIT 2",
      )
      .all() as Array<{ score: number }>;

    if (rows.length < 2) return null;

    // rows[0] is the most recent (just inserted), rows[1] is previous
    const previousScore = rows[1].score;
    const delta = Math.round((currentScore - previousScore) * 10) / 10;

    if (delta >= -5) return null;

    return {
      before: previousScore,
      after: currentScore,
      delta,
    };
  } catch (err) {
    logger.warn("harness:regression:error", { error: String(err) });
    return null;
  }
}
