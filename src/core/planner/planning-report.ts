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
 * Planning Report — generates a structured report for sprint planning.
 * Includes recommended order, missing docs, and risk assessment.
 */

import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { findNextTask } from "./next-task.js";
import { calculateVelocity } from "./velocity.js";
import { runHarnessScanCached } from "../harness/harness-cache.js";
import { XP_SIZE_POINTS } from "../utils/xp-sizing.js";
import { logger } from "../utils/logger.js";

export interface PlanningReport {
  /** Recommended task execution order */
  recommendedOrder: Array<{
    id: string;
    title: string;
    type: string;
    priority: number;
    xpSize: string;
    reason: string;
  }>;
  /** Tasks that exceed sprint capacity */
  overflow: Array<{
    id: string;
    title: string;
    type: string;
    priority: number;
    xpSize: string;
    points: number;
  }>;
  /** Suggestions for handling overflow tasks */
  redistributionSuggestions: string[];
  /** Libraries or topics with missing documentation */
  missingDocs: string[];
  /** Risk assessment */
  risks: Array<{
    nodeId: string;
    title: string;
    risk: string;
    severity: "low" | "medium" | "high";
  }>;
  /** Summary metrics */
  summary: {
    totalReady: number;
    totalBlocked: number;
    estimatedPoints: number;
    avgVelocity: number | null;
    suggestedCapacity: number | null;
  };
}

/**
 * Generate a planning report for the current sprint.
 */
export function generatePlanningReport(
  doc: GraphDocument,
  store: SqliteStore,
  capacityPoints?: number,
): PlanningReport {
  const eligibleNodes = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      (n.status === "backlog" || n.status === "ready") &&
      !n.blocked,
  );

  const blockedNodes = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      (n.status === "blocked" || n.blocked),
  );

  // Build recommended order using next-task algorithm iteratively
  const recommendedOrder = buildRecommendedOrder(doc);

  // Assess missing docs
  const missingDocs = assessMissingDocs(store, eligibleNodes);

  // Assess risks
  const risks = assessRisks(doc, eligibleNodes, blockedNodes);

  // Velocity
  const velocity = calculateVelocity(doc);

  const estimatedPoints = eligibleNodes.reduce(
    (sum, n) => sum + (XP_SIZE_POINTS[n.xpSize ?? "M"] ?? 3),
    0,
  );

  // Capacity overflow: split recommendedOrder when capacityPoints is set
  let finalOrder = recommendedOrder;
  let overflow: PlanningReport["overflow"] = [];
  let redistributionSuggestions: string[] = [];

  if (capacityPoints !== undefined) {
    let cumulative = 0;
    const withinCapacity: typeof recommendedOrder = [];
    const overflowItems: PlanningReport["overflow"] = [];

    for (const itemValue of recommendedOrder) {
      const points = XP_SIZE_POINTS[itemValue.xpSize] ?? 3;
      if (cumulative + points <= capacityPoints) {
        cumulative += points;
        withinCapacity.push(itemValue);
      } else {
        overflowItems.push({
          id: itemValue.id,
          title: itemValue.title,
          type: itemValue.type,
          priority: itemValue.priority,
          xpSize: itemValue.xpSize,
          points,
        });
      }
    }

    finalOrder = withinCapacity;
    overflow = overflowItems;
    redistributionSuggestions = buildRedistributionSuggestions(overflowItems);
  }

  const suggestedCapacity = velocity.overall.avgPointsPerSprint > 0
    ? velocity.overall.avgPointsPerSprint
    : null;

  logger.info("Planning report generated", {
    ready: eligibleNodes.length,
    blocked: blockedNodes.length,
    points: estimatedPoints,
    overflow: overflow.length,
  });

  // Harness context (non-blocking)
  let harnessContext: { score: number; grade: string; weakDimensions: string[] } | null = null;
  try {
    const harness = runHarnessScanCached(process.cwd());
    if (harness) {
      const breakdown = harness.breakdown as Record<string, { score: number }>;
      const weakDimensions = Object.entries(breakdown)
        .filter(([, info]) => info.score < 70)
        .map(([dim]) => dim);
      harnessContext = { score: harness.score, grade: harness.grade, weakDimensions };
    }
  } catch (err) {
    logger.debug("intentional-swallow", { error: String(err), reason: "non-blocking harness check" });
  }

  return {
    recommendedOrder: finalOrder,
    overflow,
    redistributionSuggestions,
    missingDocs,
    risks,
    summary: {
      totalReady: eligibleNodes.length,
      totalBlocked: blockedNodes.length,
      estimatedPoints,
      avgVelocity: velocity.overall.avgPointsPerSprint,
      suggestedCapacity,
    },
    ...(harnessContext ? { harnessContext } : {}),
  };
}

function buildRecommendedOrder(
  doc: GraphDocument,
): PlanningReport["recommendedOrder"] {
  // Clone the doc to simulate progressive execution
  const remaining = new Set(
    doc.nodes
      .filter(
        (n) =>
          (n.type === "task" || n.type === "subtask") &&
          (n.status === "backlog" || n.status === "ready") &&
          !n.blocked,
      )
      .map((n) => n.id),
  );

  const order: PlanningReport["recommendedOrder"] = [];
  const simulatedDone = new Set(
    doc.nodes.filter((n) => n.status === "done").map((n) => n.id),
  );

  // Bug #087: increased cap from 20 to 100 to handle larger graphs
  const MAX_ITERATIONS = Math.min(remaining.size, 100);
  for (let i = 0; i < MAX_ITERATIONS && remaining.size > 0; i++) {
    const resultValue = findNextTask({
      ...doc,
      nodes: doc.nodes.map((n) => {
        if (simulatedDone.has(n.id)) return { ...n, status: "done" as const };
        return n;
      }),
    });

    if (!resultValue || !remaining.has(resultValue.node.id)) break;

    order.push({
      id: resultValue.node.id,
      title: resultValue.node.title,
      type: resultValue.node.type,
      priority: resultValue.node.priority,
      xpSize: resultValue.node.xpSize ?? "M",
      reason: resultValue.reason,
    });

    simulatedDone.add(resultValue.node.id);
    remaining.delete(resultValue.node.id);
  }

  return order;
}

function assessMissingDocs(
  store: SqliteStore,
  nodes: GraphNode[],
): string[] {
  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    if (knowledgeStore.count() === 0) return ["No knowledge documents indexed"];

    const missing: string[] = [];
    const checked = new Set<string>();

    for (const node of nodes) {
      const tags = node.tags ?? [];
      for (const tag of tags) {
        if (checked.has(tag)) continue;
        checked.add(tag);

        const results = knowledgeStore.search(tag, 1);
        if (results.length === 0) {
          missing.push(tag);
        }
      }
    }

    return missing;
  } catch {
    return [];
  }
}

function assessRisks(
  doc: GraphDocument,
  eligible: GraphNode[],
  blocked: GraphNode[],
): PlanningReport["risks"] {
  const risks: PlanningReport["risks"] = [];

  // Blocked tasks are a risk
  for (const node of blocked) {
    risks.push({
      nodeId: node.id,
      title: node.title,
      risk: "Task is blocked",
      severity: "high",
    });
  }

  // Tasks with many dependencies
  for (const node of eligible) {
    const deps = doc.edges.filter(
      (e) => e.from === node.id && e.relationType === "depends_on",
    );
    if (deps.length >= 3) {
      risks.push({
        nodeId: node.id,
        title: node.title,
        risk: `Has ${deps.length} dependencies`,
        severity: "medium",
      });
    }
  }

  // XL tasks are risky
  for (const node of eligible) {
    if (node.xpSize === "XL") {
      risks.push({
        nodeId: node.id,
        title: node.title,
        risk: "Extra-large task — consider decomposing",
        severity: "medium",
      });
    }
  }

  return risks;
}

function buildRedistributionSuggestions(
  overflow: PlanningReport["overflow"],
): string[] {
  const suggestions: string[] = [];

  const hasXL = overflow.some((o) => o.xpSize === "XL");
  if (hasXL) {
    suggestions.push("Consider splitting XL tasks into smaller units before next sprint");
  }

  const hasLowPriority = overflow.some((o) => o.priority >= 4);
  if (hasLowPriority) {
    suggestions.push("Defer low-priority items (priority >= 4) to a future sprint");
  }

  if (overflow.length > 0 && suggestions.length === 0) {
    suggestions.push(`${overflow.length} task(s) exceed sprint capacity — review scope or increase capacity`);
  }

  return suggestions;
}
