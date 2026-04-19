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
 * Performance Budget Analyzer — checks performance budget node status.
 *
 * Checks:
 * - Metadata has metricName and threshold
 * - Status from metadata.status or default "untested"
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export type BudgetStatus = "untested" | "passing" | "failing";

export interface PerformanceBudgetReport {
  budgets: Array<{ nodeId: string; title: string; metric: string; threshold: string; status: BudgetStatus }>;
  totalBudgets: number;
  untestedCount: number;
}

function toBudgetStatus(value: unknown): BudgetStatus {
  if (value === "passing" || value === "failing") return value;
  return "untested";
}

export function analyzePerformanceBudgets(doc: GraphDocument): PerformanceBudgetReport {
  const budgetNodes = doc.nodes.filter((n) => n.type === "performance_budget");

  const budgets: PerformanceBudgetReport["budgets"] = [];
  let untestedCount = 0;

  for (const node of budgetNodes) {
    const metric = typeof node.metadata?.metricName === "string" ? node.metadata.metricName : "unknown";
    const threshold = typeof node.metadata?.threshold === "string"
      ? node.metadata.threshold
      : typeof node.metadata?.threshold === "number"
        ? String(node.metadata.threshold)
        : "unspecified";
    const status = toBudgetStatus(node.metadata?.status);

    if (status === "untested") untestedCount++;

    budgets.push({ nodeId: node.id, title: node.title, metric, threshold, status });
  }

  logger.debug("analyzer:performance-budget", {
    totalBudgets: budgetNodes.length,
    untestedCount,
  });

  return {
    budgets,
    totalBudgets: budgetNodes.length,
    untestedCount,
  };
}
