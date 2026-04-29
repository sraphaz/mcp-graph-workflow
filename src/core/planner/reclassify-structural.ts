/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Retroactively flag PRD-imported task/epic/subtask nodes whose titles match
 * structural-heading heuristics (e.g. "TIER A — ...", "Sequenciamento (4 sprints)").
 * List-then-apply pattern: read-only by default, mutates only when apply=true.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { logger } from "../utils/logger.js";

const STRUCTURAL_HEADING_PATTERNS: RegExp[] = [
  /^\s*TIER\s+[A-Z]\s*[—-]/i,
  /\(\s*\d+\s+(?:itens?|items?|sprints?)\b/i,
  /^\s*Roadmap\b/i,
  /^\s*Princípio(?:s)?\s+/i,
  /^\s*Sequenciamento\b/i,
  /^\s*Arquivos\s+cr[ií]ticos\b/i,
];

function isStructuralHeading(title: string): boolean {
  return STRUCTURAL_HEADING_PATTERNS.some((re) => re.test(title));
}

export interface ReclassifyCandidate {
  nodeId: string;
  title: string;
  type: string;
  reason: string;
  alreadyMarked: boolean;
}

export interface ReclassifyReport {
  candidates: ReclassifyCandidate[];
  totalCandidates: number;
  applied: number;
}

const ELIGIBLE_TYPES = new Set(["task", "subtask", "epic"]);

export function findStructuralCandidates(doc: GraphDocument): ReclassifyCandidate[] {
  const candidates: ReclassifyCandidate[] = [];
  for (const node of doc.nodes) {
    if (!ELIGIBLE_TYPES.has(node.type)) continue;
    if (!isStructuralHeading(node.title)) continue;
    candidates.push({
      nodeId: node.id,
      title: node.title,
      type: node.type,
      reason: matchReason(node.title),
      alreadyMarked: node.metadata?.implementable === false,
    });
  }
  return candidates;
}

function matchReason(title: string): string {
  if (/^\s*TIER\s+[A-Z]\s*[—-]/i.test(title)) return "TIER X — heading";
  if (/\(\s*\d+\s+(?:itens?|items?|sprints?)\b/i.test(title)) return "parenthetical count suffix";
  if (/^\s*Roadmap\b/i.test(title)) return "Roadmap section";
  if (/^\s*Princípio(?:s)?\s+/i.test(title)) return "Princípio section";
  if (/^\s*Sequenciamento\b/i.test(title)) return "Sequenciamento section";
  if (/^\s*Arquivos\s+cr[ií]ticos\b/i.test(title)) return "Arquivos críticos section";
  return "structural heading pattern";
}

/**
 * Apply `metadata.implementable=false` to nodes whose titles match the
 * structural heading heuristic. Idempotent — already-marked nodes count
 * toward `totalCandidates` but not toward `applied`.
 */
export function reclassifyStructural(
  doc: GraphDocument,
  store: SqliteStore,
  options: { apply: boolean },
): ReclassifyReport {
  const candidates = findStructuralCandidates(doc);
  let applied = 0;

  if (options.apply) {
    for (const candidate of candidates) {
      if (candidate.alreadyMarked) continue;
      const node = doc.nodes.find((n) => n.id === candidate.nodeId);
      if (!node) continue;
      const nextMetadata = { ...(node.metadata ?? {}), implementable: false };
      const result = store.updateNode(candidate.nodeId, { metadata: nextMetadata });
      if (result) applied++;
    }
    logger.info("reclassify-structural:applied", { applied, totalCandidates: candidates.length });
  } else {
    logger.info("reclassify-structural:dry-run", { totalCandidates: candidates.length });
  }

  return { candidates, totalCandidates: candidates.length, applied };
}
