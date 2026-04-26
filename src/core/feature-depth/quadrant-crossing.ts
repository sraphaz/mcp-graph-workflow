/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Detects whether a file score crossed a quadrant boundary between
 * runs (e.g. SHALLOW → SPECIALIZED). Used by finish_task to seed
 * memory entries for **positive** crossings — the project's empirical
 * narrative of where deepening actually happened.
 *
 * Negative crossings (MATURE → SHALLOW) are NOT memory-worthy events;
 * they're operational warnings handled by the regression gate.
 * Positives build history, negatives stop bleeding — different paths.
 */

import { quadrantOf, quadrantRank, type Quadrant } from "./quadrant.js";

export interface CrossingEvent {
  readonly from: Quadrant;
  readonly to: Quadrant;
  readonly direction: "up" | "down";
  readonly delta: number;
  readonly priorScore: number;
  readonly currentScore: number;
}

/**
 * Returns the crossing event when a quadrant boundary was crossed,
 * or null if the file stayed in the same quadrant. `priorScore=null`
 * (fresh file) is never a crossing — first observation establishes
 * the baseline, no narrative arc yet.
 */
export function detectQuadrantCrossing(
  priorScore: number | null,
  currentScore: number,
): CrossingEvent | null {
  if (priorScore === null) return null;

  const from = quadrantOf(priorScore);
  const to = quadrantOf(currentScore);
  if (from === to) return null;

  const direction = quadrantRank(to) > quadrantRank(from) ? "up" : "down";
  return {
    from,
    to,
    direction,
    delta: currentScore - priorScore,
    priorScore,
    currentScore,
  };
}
