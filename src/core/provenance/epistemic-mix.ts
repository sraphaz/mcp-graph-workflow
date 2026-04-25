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
 * Epistemic Mix — pure computation layer for tier distribution visualizations.
 *
 * Computes stratified tier counts and percentages from a list of nodes,
 * groups nodes by tier for drill-down views, and flags epics with >50%
 * claim nodes as low-maturity.
 */

import type { EpistemicTier } from "./tier-promotion.js";

export interface TierNode {
  readonly id: string;
  readonly title: string;
  readonly tier: EpistemicTier;
}

export interface TierDistribution {
  readonly claim: number;
  readonly cited: number;
  readonly validated: number;
  readonly proven: number;
  readonly total: number;
  /** Percentage values (0–100) */
  readonly claimPct: number;
  readonly citedPct: number;
  readonly validatedPct: number;
  readonly provenPct: number;
}

export type GroupedByTier = Record<EpistemicTier, TierNode[]>;

/**
 * Compute tier counts and percentages for a list of nodes.
 * Returns zero percentages when total is 0 (avoids division by zero).
 */
export function computeTierDistribution(nodes: TierNode[]): TierDistribution {
  const counts = { claim: 0, cited: 0, validated: 0, proven: 0 };
  for (const node of nodes) {
    counts[node.tier]++;
  }
  const total = nodes.length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100 * 10) / 10);
  return {
    ...counts,
    total,
    claimPct: pct(counts.claim),
    citedPct: pct(counts.cited),
    validatedPct: pct(counts.validated),
    provenPct: pct(counts.proven),
  };
}

/** Group nodes by their epistemic tier, returning arrays per tier. */
export function groupNodesByTier(nodes: TierNode[]): GroupedByTier {
  const groups: GroupedByTier = { claim: [], cited: [], validated: [], proven: [] };
  for (const node of nodes) {
    groups[node.tier].push(node);
  }
  return groups;
}

/**
 * Returns true when more than 50% of nodes in the distribution are at "claim" tier,
 * indicating the epic has low epistemic maturity.
 */
export function isLowMaturityEpic(dist: TierDistribution): boolean {
  if (dist.total === 0) return false;
  return dist.claim / dist.total > 0.5;
}
