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

import { useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";

type EpistemicTier = "claim" | "cited" | "validated" | "proven";

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
  readonly claimPct: number;
  readonly citedPct: number;
  readonly validatedPct: number;
  readonly provenPct: number;
}

export type GroupedByTier = Record<EpistemicTier, TierNode[]>;

const TIER_COLORS: Record<EpistemicTier, string> = {
  claim:     "#f97316", // orange — unverified
  cited:     "#eab308", // yellow — referenced
  validated: "#22c55e", // green  — test-backed
  proven:    "#3b82f6", // blue   — hash-anchored
};

const TIER_LABELS: Record<EpistemicTier, string> = {
  claim:     "Claim",
  cited:     "Cited",
  validated: "Validated",
  proven:    "Proven",
};

const TIERS: EpistemicTier[] = ["claim", "cited", "validated", "proven"];

interface EpistemicTierBarProps {
  distribution: TierDistribution;
  groupedNodes: GroupedByTier;
  isLowMaturity: boolean;
  className?: string;
}

export function EpistemicTierBar({
  distribution,
  groupedNodes,
  isLowMaturity,
  className,
}: EpistemicTierBarProps): React.JSX.Element {
  const [expandedTier, setExpandedTier] = useState<EpistemicTier | null>(null);

  const handleSegmentClick = (tier: EpistemicTier) => {
    setExpandedTier((prev) => (prev === tier ? null : tier));
  };

  if (distribution.total === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted py-4 ${className ?? ""}`}>
        No nodes with epistemic tier data
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {isLowMaturity && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Baixa maturidade epistêmica — mais de 50% dos nodes em <strong>claim</strong></span>
        </div>
      )}

      {/* Stratified bar */}
      <div
        className="flex h-8 w-full overflow-hidden rounded-lg"
        role="img"
        aria-label={`Epistemic tier distribution: ${distribution.claim} claim, ${distribution.cited} cited, ${distribution.validated} validated, ${distribution.proven} proven`}
      >
        {TIERS.map((tier) => {
          const count = distribution[tier];
          if (count === 0) return null;
          const pct = (count / distribution.total) * 100;
          const isActive = expandedTier === tier;
          return (
            <button
              key={tier}
              style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[tier] }}
              className={`relative h-full cursor-pointer transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 ${isActive ? "opacity-100 ring-2 ring-white/60" : "opacity-80 hover:opacity-100"}`}
              title={`${TIER_LABELS[tier]}: ${count} nodes (${pct.toFixed(1)}%)`}
              onClick={() => handleSegmentClick(tier)}
              aria-pressed={isActive}
            >
              {pct > 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow">
                  {TIER_LABELS[tier]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {TIERS.map((tier) => {
          const count = distribution[tier];
          const pct = distribution.total > 0 ? ((count / distribution.total) * 100).toFixed(1) : "0.0";
          return (
            <button
              key={tier}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${expandedTier === tier ? "bg-surface-alt ring-1 ring-edge" : "hover:bg-surface-alt"}`}
              onClick={() => handleSegmentClick(tier)}
              aria-pressed={expandedTier === tier}
            >
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: TIER_COLORS[tier] }} />
              <span className="text-text-secondary">{TIER_LABELS[tier]}</span>
              <span className="font-medium text-text-primary">{count}</span>
              <span className="text-text-muted">({pct}%)</span>
            </button>
          );
        })}
        <span className="ml-auto text-xs text-text-muted self-center">Total: {distribution.total}</span>
      </div>

      {/* Expanded tier node list (AC2) */}
      {expandedTier !== null && (
        <div className="rounded-lg border border-edge bg-surface-alt">
          <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: TIER_COLORS[expandedTier] }}
              />
              <span className="text-sm font-medium text-text-primary">
                {TIER_LABELS[expandedTier]} nodes
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">
                {groupedNodes[expandedTier].length}
              </span>
            </div>
            <button
              className="rounded p-0.5 text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setExpandedTier(null)}
              aria-label="Close tier detail"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="max-h-56 overflow-y-auto divide-y divide-edge/50">
            {groupedNodes[expandedTier].length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-muted">No nodes in this tier</li>
            ) : (
              groupedNodes[expandedTier].map((node) => (
                <li key={node.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <ChevronRight size={12} className="shrink-0 text-text-muted" />
                  <span className="text-text-secondary font-mono">{node.id.slice(0, 8)}</span>
                  <span className="text-text-primary truncate">{node.title}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
