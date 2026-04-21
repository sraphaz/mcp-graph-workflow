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
 * Enhanced Next Task — considers knowledge coverage, velocity data,
 * and dependencies for smarter task recommendations.
 */

import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { findNextTask, type NextTaskResult } from "./next-task.js";
import { calculateVelocity } from "./velocity.js";
import { runHarnessScanCached } from "../harness/harness-cache.js";
import type { LockManager } from "../store/lock-manager.js";
import { PlannerError, getErrorMessage } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** Maps common task tags to harness dimension keys */
const TAG_TO_DIMENSION: Record<string, string> = {
  test: "tests", testing: "tests", tdd: "tests",
  docs: "docs", documentation: "docs", jsdoc: "docs",
  types: "types", typescript: "types", typing: "types",
  naming: "naming", refactor: "naming",
  error: "errorHandling", errors: "errorHandling",
  fitness: "fitness", architecture: "fitness",
  context: "contextDensity",
};

export interface EnhancedNextResult {
  /** The recommended task */
  task: NextTaskResult;
  /** Knowledge coverage score (0-1) */
  knowledgeCoverage: number;
  /** Historical velocity context */
  velocityContext: {
    avgCompletionHours: number | null;
    estimatedHours: number | null;
  };
  /** Reason for recommendation */
  enhancedReason: string;
  /** Harness-aware bonus info (if applicable) */
  harnessBonus?: {
    applied: boolean;
    weakDimensions: string[];
    matchedTags: string[];
  };
}

export interface EnhancedNextOptions {
  /** LockManager for teamTask mode — used to exclude locked tasks */
  lockManager?: LockManager;
  /** Agent ID for teamTask mode — exclude tasks locked by other agents */
  agentId?: string;
}

/**
 * Find the next task with enhanced context from knowledge store and velocity.
 */
export function findEnhancedNextTask(
  doc: GraphDocument,
  store: SqliteStore,
  options?: EnhancedNextOptions,
): EnhancedNextResult | null {
  if (!doc || !doc.nodes) {
    throw new PlannerError("Invalid graph document: missing nodes");
  }
  // Build locked task IDs set for teamTask mode
  let lockedTaskIds: Set<string> | undefined;
  let inFlightTouchedFiles: Set<string> | undefined;
  if (options?.lockManager && options?.agentId) {
    const activeLocks = options.lockManager.listActive();
    lockedTaskIds = new Set(
      activeLocks
        .filter((l) => l.agentId !== options.agentId && l.resourceType === "task")
        .map((l) => l.resourceId.replace("task:", "")),
    );
    // Collect files locked by other agents for file-overlap exclusion
    const fileLocks = activeLocks.filter(
      (l) => l.agentId !== options.agentId && l.resourceType === "file",
    );
    if (fileLocks.length > 0) {
      inFlightTouchedFiles = new Set(fileLocks.map((l) => l.resourceId.replace(/^file:/, "")));
    }
  }

  const baseResult = findNextTask(doc, { lockedTaskIds, inFlightTouchedFiles });
  if (!baseResult) return null;

  const knowledgeCoverage = assessKnowledgeCoverage(store, baseResult.node);
  const velocityContext = getVelocityContext(doc, baseResult.node);

  const reasons: string[] = [baseResult.reason];

  if (knowledgeCoverage > 0.5) {
    reasons.push(`Good knowledge coverage (${Math.round(knowledgeCoverage * 100)}%)`);
  } else if (knowledgeCoverage < 0.2) {
    reasons.push("Low knowledge coverage — consider adding reference docs");
  }

  if (velocityContext.estimatedHours !== null) {
    reasons.push(`Estimated ~${velocityContext.estimatedHours}h based on velocity`);
  }

  // Harness-aware bonus: detect weak dimensions and match task tags
  let harnessBonus: EnhancedNextResult["harnessBonus"];
  try {
    const harness = runHarnessScanCached(process.cwd());
    if (harness) {
      const breakdown = harness.breakdown as Record<string, { score: number }>;
      const weakDimensions = Object.entries(breakdown)
        .filter(([, info]) => info.score < 70)
        .map(([dim]) => dim);

      if (weakDimensions.length > 0) {
        const taskTags = baseResult.node.tags ?? [];
        const matchedTags = taskTags.filter((tag) => {
          const dim = TAG_TO_DIMENSION[tag.toLowerCase()];
          return dim && weakDimensions.includes(dim);
        });

        if (matchedTags.length > 0) {
          reasons.push(`Harness bonus: tags [${matchedTags.join(", ")}] match weak dimensions [${weakDimensions.join(", ")}]`);
          harnessBonus = { applied: true, weakDimensions, matchedTags };
        } else {
          harnessBonus = { applied: false, weakDimensions, matchedTags: [] };
        }
      }
    }
  } catch (err) {
    logger.debug("enhanced-next: harness scan failed", { error: getErrorMessage(err) });
  }

  logger.info("Enhanced next task", {
    nodeId: baseResult.node.id,
    knowledgeCoverage,
    estimatedHours: velocityContext.estimatedHours,
    harnessBonus: harnessBonus?.applied ?? false,
  });

  return {
    task: baseResult,
    knowledgeCoverage,
    velocityContext,
    enhancedReason: reasons.join(". "),
    ...(harnessBonus ? { harnessBonus } : {}),
  };
}

/**
 * Assess how well a task is covered by knowledge documents.
 * Returns 0-1 score based on FTS matches.
 */
function assessKnowledgeCoverage(store: SqliteStore, node: GraphNode): number {
  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    const totalKnowledge = knowledgeStore.count();
    if (totalKnowledge === 0) return 0;

    const terms = node.title.split(/\s+/).filter((w) => w.length > 2);
    if (terms.length === 0) return 0;

    const query = terms.join(" OR ");
    const results = knowledgeStore.search(query, 5);

    // Score: proportion of terms that got matches, capped at 1
    const matchedTerms = new Set<string>();
    for (const result of results) {
      const contentLower = (result.title + " " + result.content).toLowerCase();
      for (const term of terms) {
        if (contentLower.includes(term.toLowerCase())) {
          matchedTerms.add(term.toLowerCase());
        }
      }
    }

    return Math.min(1, matchedTerms.size / terms.length);
  } catch (err) {
    logger.debug("enhanced-next: knowledge coverage failed", { error: getErrorMessage(err) });
    return 0;
  }
}

/**
 * Get velocity context for estimating task completion time.
 */
function getVelocityContext(
  doc: GraphDocument,
  node: GraphNode,
): { avgCompletionHours: number | null; estimatedHours: number | null } {
  const velocity = calculateVelocity(doc);

  const avgHours = velocity.overall.avgCompletionHours;
  if (avgHours === null) {
    return { avgCompletionHours: null, estimatedHours: null };
  }

  // Estimate based on XP size relative to average
  const XP_MULTIPLIER: Record<string, number> = {
    XS: 0.25, S: 0.5, M: 1, L: 2, XL: 4,
  };
  const multiplier = XP_MULTIPLIER[node.xpSize ?? "M"] ?? 1;
  const estimatedHours = Math.round(avgHours * multiplier * 10) / 10;

  return { avgCompletionHours: avgHours, estimatedHours };
}
