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
 * Deterministic Ranker — stable, reproducible ordering of search results.
 *
 * Primary sort: score descending (higher is better).
 * Tiebreaker: id ascending (lexicographic) — deterministic across runs.
 *
 * Also provides scoresDriftWithinTolerance for reindex regression detection.
 */

export interface RankableItem {
  readonly id: string;
  readonly score: number;
}

/**
 * Sort items by score descending, with id ascending as deterministic tiebreaker.
 * Does not mutate the input array.
 */
export function deterministicRank<T extends RankableItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Check whether scores changed by more than `tolerance` after a reindex.
 *
 * Returns `true` when all items in `before` that appear in `after` have
 * abs(after.score - before.score) <= tolerance.
 * Newly added items (in `after` but not `before`) are not penalized.
 * Items removed from `after` (present in `before`) count as a violation.
 */
export function scoresDriftWithinTolerance(
  before: readonly RankableItem[],
  after: readonly RankableItem[],
  tolerance: number,
): boolean {
  const afterMap = new Map(after.map(item => [item.id, item.score]));

  for (const prev of before) {
    const nextScore = afterMap.get(prev.id);
    if (nextScore === undefined) {
      return false;
    }
    if (Math.abs(nextScore - prev.score) > tolerance) {
      return false;
    }
  }

  return true;
}
