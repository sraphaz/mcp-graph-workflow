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
 * Decision Principles — built-in + custom principles evaluated during ADR challenge.
 *
 * Each principle defines violation keywords. When a decision's description
 * matches violation keywords, a finding is generated with appropriate severity.
 */

import type { GraphNode } from "../graph/graph-types.js";
import type { FindingDimension, FindingSeverity } from "./severity-scoring.js";

// ── Types ───────────────────────────────────────────────

export interface DecisionPrinciple {
  id: string;
  name: string;
  description: string;
  dimension: FindingDimension;
  violationKeywords: string[];
}

export interface PrincipleViolation {
  principleId: string;
  principleName: string;
  dimension: FindingDimension;
  severity: FindingSeverity;
  message: string;
}

// ── Built-in Principles ─────────────────────────────────

export const BUILT_IN_PRINCIPLES: DecisionPrinciple[] = [
  {
    id: "zero-config-default",
    name: "Optimize for zero-config default",
    description: "Decisions should work out of the box without requiring manual configuration",
    dimension: "friction",
    violationKeywords: ["configuration required", "must configure", "setup required", "manual setup"],
  },
  {
    id: "prefer-reversible",
    name: "Prefer reversible over irreversible",
    description: "Favor decisions that can be easily reversed over permanent commitments",
    dimension: "reversibility",
    violationKeywords: ["permanent", "irreversible", "vendor lock-in", "lock-in", "breaking change", "schema migration"],
  },
  {
    id: "minimize-friction",
    name: "Minimize user friction",
    description: "Reduce the number of steps and dependencies required from users",
    dimension: "friction",
    violationKeywords: ["npm install", "manual step", "extra dependency", "additional install", "prerequisite"],
  },
  {
    id: "align-majority-use-case",
    name: "Align with majority use case",
    description: "Optimize for the most common usage pattern, not edge cases",
    dimension: "optimality",
    violationKeywords: ["edge case only", "niche requirement", "rarely used", "special case"],
  },
];

// ── Evaluation ──────────────────────────────────────────

/**
 * Evaluate a decision node against a set of principles.
 * Returns violations for each principle whose keywords match the description.
 */
export function evaluateDecisionPrinciples(
  decision: GraphNode,
  principles: DecisionPrinciple[],
): PrincipleViolation[] {
  const text = (decision.description ?? "").toLowerCase();
  if (text.length === 0) return [];

  const violations: PrincipleViolation[] = [];

  for (const principle of principles) {
    const matchedKeywords = principle.violationKeywords.filter(
      (kw) => text.includes(kw.toLowerCase()),
    );

    if (matchedKeywords.length > 0) {
      violations.push({
        principleId: principle.id,
        principleName: principle.name,
        dimension: principle.dimension,
        severity: classifyViolationSeverity(matchedKeywords.length),
        message: `Violates "${principle.name}": detected ${matchedKeywords.join(", ")}`,
      });
    }
  }

  return violations;
}

/** Classify severity based on how many keywords matched. */
function classifyViolationSeverity(matchCount: number): FindingSeverity {
  if (matchCount >= 3) return "critical";
  if (matchCount >= 2) return "warning";
  return "info";
}
