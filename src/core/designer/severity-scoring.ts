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
 * Severity Scoring System — classifies and sorts findings by severity.
 *
 * Used by all challenge engine components (fitness, JTBD, pre-mortem).
 * 3 levels: critical (blocks decision), warning (needs attention), info (observation).
 */

// ── Types ───────────────────────────────────────────────

export type FindingSeverity = "critical" | "warning" | "info";
export type FindingSource = "fitness" | "jtbd" | "premortem";
export type FindingDimension = "friction" | "optimality" | "reversibility" | "general";

export interface Finding {
  message: string;
  source: FindingSource;
  dimension: FindingDimension;
  severity: FindingSeverity;
}

// ── Constants ───────────────────────────────────────────

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const ELEVATION_THRESHOLD = 40;
const ELEVATABLE_DIMENSIONS: ReadonlySet<FindingDimension> = new Set(["friction", "optimality"]);

// ── Functions ───────────────────────────────────────────

/**
 * Classify a finding's severity based on its score.
 * - score < 20 → critical
 * - score 20-59 → warning
 * - score >= 60 → info
 */
export function classifyFindingSeverity(score: number): FindingSeverity {
  if (score < 20) return "critical";
  if (score < 60) return "warning";
  return "info";
}

/**
 * Sort findings by severity: critical first, then warning, then info.
 * Stable sort — preserves order within same severity.
 */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

/**
 * Elevate friction and optimality findings to critical when composite score is low.
 * Returns a new array — does not mutate the input.
 *
 * Rule: composite < 40 → all friction/optimality findings become critical.
 */
export function elevateFindings(findings: Finding[], compositeScore: number): Finding[] {
  if (compositeScore >= ELEVATION_THRESHOLD) {
    return findings.map((f) => ({ ...f }));
  }

  return findings.map((f) => {
    if (ELEVATABLE_DIMENSIONS.has(f.dimension)) {
      return { ...f, severity: "critical" as FindingSeverity };
    }
    return { ...f };
  });
}
