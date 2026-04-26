/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * 4-quadrant classification for file-level scores.
 *
 * Note on the difference from the Go implementation: the Go tool
 * (tools/feature-depth/scorer/quadrant.go) classifies modules by
 * **median** of the dataset (each quadrant has roughly N/4 modules).
 * That's good for relative comparisons but unstable for detecting
 * "crossing" between runs — a module's quadrant can shift just
 * because another module changed.
 *
 * This module uses **absolute thresholds** (≥70 / 50-70 / 30-50 / <30)
 * so a file's quadrant only changes when its score actually moves.
 * That's what the auto-memory crossing detector needs.
 */

export type Quadrant = "MATURE" | "SPECIALIZED" | "SHALLOW" | "INCIPIENT";

export const QUADRANT_THRESHOLDS = {
  matureMin: 70,
  specializedMin: 50,
  shallowMin: 30,
} as const;

/** Map a numeric score (0-100) to its quadrant. */
export function quadrantOf(score: number): Quadrant {
  if (score >= QUADRANT_THRESHOLDS.matureMin) return "MATURE";
  if (score >= QUADRANT_THRESHOLDS.specializedMin) return "SPECIALIZED";
  if (score >= QUADRANT_THRESHOLDS.shallowMin) return "SHALLOW";
  return "INCIPIENT";
}

/** Numeric ordering: INCIPIENT (0) < SHALLOW (1) < SPECIALIZED (2) < MATURE (3). */
export function quadrantRank(q: Quadrant): number {
  switch (q) {
    case "INCIPIENT":
      return 0;
    case "SHALLOW":
      return 1;
    case "SPECIALIZED":
      return 2;
    case "MATURE":
      return 3;
  }
}
