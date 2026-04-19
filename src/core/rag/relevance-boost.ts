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
 * Relevance Boost — applies implicit feedback boosts to RAG search scores.
 * Used after RRF fusion to adjust final rankings based on feedback history.
 */

import type Database from "better-sqlite3";
import { RelevanceTracker } from "./relevance-tracker.js";
import { logger } from "../utils/logger.js";

export interface ScoredResult {
  id: string;
  score: number;
  [key: string]: unknown;
}

/**
 * Apply relevance boosts from feedback history to scored results.
 * Modifies scores in-place and returns the (same) array sorted by new scores.
 */
export function applyRelevanceBoosts<T extends ScoredResult>(
  db: Database.Database,
  results: T[],
): T[] {
  if (results.length === 0) return results;

  const tracker = new RelevanceTracker(db);
  const docIds = results.map((r) => r.id);
  const boosts = tracker.getRelevanceBoost(docIds);

  let boostedCount = 0;

  for (const result of results) {
    const boost = boosts.get(result.id) ?? 0;
    if (boost !== 0) {
      result.score = Math.max(0, result.score + boost);
      boostedCount++;
    }
  }

  if (boostedCount > 0) {
    logger.debug("relevance-boost:applied", { boostedCount, totalResults: results.length });
  }

  return results;
}
