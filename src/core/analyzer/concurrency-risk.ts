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
 * Concurrency Risk Analyzer — detects potential race conditions via heuristics.
 *
 * Checks:
 * - Tasks with concurrency-related keywords (trade, inventory, gold, simultaneous, concurrent, shared state, atomic)
 * - Tasks that modify the same entity (matching title/description keywords)
 * - Reports potential concurrency risks with suggested test scenarios
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

const CONCURRENCY_KEYWORDS = [
  "trade",
  "inventory",
  "gold",
  "simultaneous",
  "concurrent",
  "shared state",
  "atomic",
  "race condition",
  "mutex",
  "lock",
  "semaphore",
  "parallel",
  "transaction",
  "deadlock",
];

export interface ConcurrencyRiskItem {
  nodeId: string;
  title: string;
  matchedKeywords: string[];
  suggestedTests: string[];
}

export interface EntityConflict {
  entity: string;
  nodeIds: string[];
}

export interface ConcurrencyRiskReport {
  totalRisks: number;
  risks: ConcurrencyRiskItem[];
  entityConflicts: EntityConflict[];
}

function extractEntityKeywords(text: string): string[] {
  // Extract significant words (4+ chars, lowercase) as entity proxies
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 4);
}

function suggestTests(keywords: string[]): string[] {
  const tests: string[] = [];
  if (keywords.some((k) => k === "trade" || k === "transaction")) {
    tests.push("Test concurrent trades on the same item");
  }
  if (keywords.some((k) => k === "inventory" || k === "gold")) {
    tests.push("Test simultaneous inventory/currency modifications");
  }
  if (keywords.some((k) => k === "simultaneous" || k === "concurrent" || k === "parallel")) {
    tests.push("Test parallel execution with shared resources");
  }
  if (keywords.some((k) => k === "atomic" || k === "lock" || k === "mutex")) {
    tests.push("Test atomicity guarantees under contention");
  }
  if (tests.length === 0) {
    tests.push("Test concurrent access to shared state");
  }
  return tests;
}

/** analyzeConcurrencyRisk — auto-generated description placeholder. */
export function analyzeConcurrencyRisk(doc: GraphDocument): ConcurrencyRiskReport {
  const tasks = doc.nodes.filter((n) => n.type === "task" || n.type === "subtask");

  const risks: ConcurrencyRiskItem[] = [];

  for (const task of tasks) {
    const searchText = `${task.title} ${task.description ?? ""}`.toLowerCase();
    const matchedKeywords = CONCURRENCY_KEYWORDS.filter((kw) => searchText.includes(kw));

    if (matchedKeywords.length > 0) {
      risks.push({
        nodeId: task.id,
        title: task.title,
        matchedKeywords,
        suggestedTests: suggestTests(matchedKeywords),
      });
    }
  }

  // Detect entity conflicts: tasks that share significant keywords in title/description
  const entityMap = new Map<string, string[]>();
  for (const task of tasks) {
    const keywords = extractEntityKeywords(`${task.title} ${task.description ?? ""}`);
    for (const kw of keywords) {
      const ids = entityMap.get(kw) ?? [];
      ids.push(task.id);
      entityMap.set(kw, ids);
    }
  }

  const entityConflicts: EntityConflict[] = [];
  for (const [entity, nodeIds] of entityMap) {
    if (nodeIds.length > 1) {
      // Only include if at least one node is already flagged as a concurrency risk
      const riskIds = new Set(risks.map((r) => r.nodeId));
      if (nodeIds.some((id) => riskIds.has(id))) {
        entityConflicts.push({ entity, nodeIds: [...new Set(nodeIds)] });
      }
    }
  }

  logger.debug("analyzer:concurrency-risk", {
    totalRisks: risks.length,
    entityConflicts: entityConflicts.length,
  });

  return {
    totalRisks: risks.length,
    risks,
    entityConflicts,
  };
}
