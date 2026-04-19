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
 * Task Readiness Score — combines the signals the graph already produces (xpSize,
 * AC quality, harness, dependency depth, issue-pattern history) into a single
 * 0–100 score and a preferred Claude model.
 *
 * Motivation: routing atomic, well-specified work to Haiku (~10× cheaper than
 * Sonnet) without sacrificing quality requires a signal that combines more
 * than just `xpSize`. A tiny task with vague ACs in a weakly-harnessed file
 * is NOT a Haiku candidate; a medium task with crisp testable ACs often is.
 *
 * Design:
 *   score = 0.35·xpScore + 0.30·acScore + 0.15·harness + 0.10·depthScore
 *         + 0.10·(100 − issuePenalty)
 *
 * Hard overrides (independent of score):
 *   - `decision`, `constitution`, `interface`, `state_machine`, `formula`,
 *     `contract` → always `opus` (architectural / durable-impact types)
 *   - no testable AC → escalate at least to `sonnet` (never Haiku blind)
 *
 * The function is pure: callers inject `harnessScore` and `patternOccurrences`
 * from wherever they track them (knowledge store, IssuePatternTracker, etc.).
 */

import type { GraphDocument, GraphNode, NodeType } from "../graph/graph-types.js";
import { XP_SIZE_ORDER } from "../utils/xp-sizing.js";
import { validateAcQuality } from "../analyzer/ac-validator.js";

export type ModelPreference = "haiku" | "sonnet" | "opus";

export interface TaskReadinessSignals {
  xpSize: { value: string; ord: number; score: number };
  acQuality: { score: number; hasTestableAc: boolean };
  /** Local harness score if known, else null. */
  harnessLocal: number | null;
  depDepth: { depth: number; score: number };
  /** Subtractive penalty (0–100). */
  issuePatternPenalty: number;
}

export interface TaskReadinessScore {
  score: number;
  signals: TaskReadinessSignals;
  recommendation: ModelPreference;
  rationale: string[];
  overridden: "high_stake_type" | "no_testable_ac" | null;
}

export interface TaskReadinessOptions {
  /** Most recent harness score (0–100). Omit when unknown — a neutral default is used. */
  harnessScore?: number | null;
  /** Historical occurrences of issue patterns tied to this node's category. */
  patternOccurrences?: number;
}

/** Node types whose decisions carry durable architectural impact. */
const HIGH_STAKE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  "decision",
  "constitution",
  "interface",
  "state_machine",
  "formula",
  "contract",
]);

/** Neutral harness default when no prior scan is known. */
const NEUTRAL_HARNESS = 65;
/** Penalty added per recorded pattern occurrence (saturates at 40). */
const PATTERN_PENALTY_STEP = 10;
const PATTERN_PENALTY_CAP = 40;

/** Map xpSize ordinal → score contribution. Smaller is better. */
function xpSizeScore(ord: number): number {
  if (ord <= 2) return 100; // XS, S
  if (ord === 3) return 70; // M
  if (ord === 4) return 40; // L
  return 10; // XL
}

/** Map dependency depth → score contribution. Deeper chains need more context. */
function depthScoreFor(depth: number): number {
  if (depth === 0) return 100;
  if (depth === 1) return 85;
  if (depth === 2) return 65;
  if (depth === 3) return 45;
  return 20;
}

export function computeTaskReadinessScore(
  node: GraphNode,
  doc: GraphDocument,
  options: TaskReadinessOptions = {},
): TaskReadinessScore {
  const rationale: string[] = [];

  // ── xpSize
  const xp = node.xpSize ?? "M";
  const ord = XP_SIZE_ORDER[xp] ?? 3;
  const xpScore = xpSizeScore(ord);

  // ── AC quality (node-scoped report)
  const acReport = validateAcQuality(doc, node.id);
  const acNode = acReport.nodes[0];
  const acScore = acNode?.score ?? 0;
  const hasTestableAc = (acNode?.parsedAcs ?? []).some((a) => a.isTestable);

  // ── Harness
  const harnessLocal = typeof options.harnessScore === "number" ? options.harnessScore : null;
  const harnessScoreForAggregate = harnessLocal ?? NEUTRAL_HARNESS;

  // ── Dependency depth (longest depends_on chain rooted at this node)
  const depth = computeDepDepth(node.id, doc);
  const depthScore = depthScoreFor(depth);

  // ── Issue-pattern penalty
  const occurrences = options.patternOccurrences ?? 0;
  const penalty = Math.min(PATTERN_PENALTY_CAP, occurrences * PATTERN_PENALTY_STEP);

  // ── Weighted aggregate
  const weighted =
    xpScore * 0.35 +
    acScore * 0.3 +
    harnessScoreForAggregate * 0.15 +
    depthScore * 0.1 +
    (100 - penalty) * 0.1;
  const score = Math.max(0, Math.min(100, Math.round(weighted)));

  // ── Overrides
  let overridden: TaskReadinessScore["overridden"] = null;
  let recommendation: ModelPreference;

  if (HIGH_STAKE_TYPES.has(node.type)) {
    recommendation = "opus";
    overridden = "high_stake_type";
    rationale.push(`node type "${node.type}" is architecturally high-stake → opus`);
  } else if (!hasTestableAc) {
    recommendation = score >= 70 ? "sonnet" : "opus";
    overridden = "no_testable_ac";
    rationale.push(`no testable AC detected → escalate to ${recommendation}`);
  } else if (score >= 85) {
    recommendation = "haiku";
    rationale.push(`score=${score} ≥ 85 with testable AC → haiku`);
  } else if (score >= 60) {
    recommendation = "sonnet";
    rationale.push(`score=${score} in [60,85) → sonnet`);
  } else {
    recommendation = "opus";
    rationale.push(`score=${score} < 60 → opus (needs strong reasoning)`);
  }

  // ── Per-signal notes (diagnostic, keep concise)
  if (xpScore < 70) rationale.push(`xpSize=${xp} drags score down`);
  if (acScore < 60) rationale.push(`ac quality ${acScore} is weak`);
  if (harnessLocal !== null && harnessLocal < 60) rationale.push(`harness ${harnessLocal} is weak`);
  if (depth >= 3) rationale.push(`${depth}-deep dependency chain — heavy context`);
  if (penalty > 0) rationale.push(`historical pattern penalty ${penalty}`);

  return {
    score,
    signals: {
      xpSize: { value: xp, ord, score: xpScore },
      acQuality: { score: acScore, hasTestableAc },
      harnessLocal,
      depDepth: { depth, score: depthScore },
      issuePatternPenalty: penalty,
    },
    recommendation,
    rationale,
    overridden,
  };
}

/**
 * Longest path of `depends_on` edges rooted at `nodeId`. Cycles are short-circuited
 * (they contribute 0 extra depth). Memoized per call.
 */
function computeDepDepth(nodeId: string, doc: GraphDocument): number {
  const memo = new Map<string, number>();
  const inProgress = new Set<string>();

  const dependsOut = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (edge.relationType !== "depends_on") continue;
    const arr = dependsOut.get(edge.from) ?? [];
    arr.push(edge.to);
    dependsOut.set(edge.from, arr);
  }

  function depth(id: string): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (inProgress.has(id)) return 0; // cycle guard
    inProgress.add(id);
    let max = 0;
    for (const next of dependsOut.get(id) ?? []) {
      const d = 1 + depth(next);
      if (d > max) max = d;
    }
    inProgress.delete(id);
    memo.set(id, max);
    return max;
  }

  return depth(nodeId);
}
