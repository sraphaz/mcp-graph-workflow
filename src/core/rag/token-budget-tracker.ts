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
 * Token Budget Tracker — monitors knowledge store token usage
 * and generates budget reports with zones and recommendations.
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export type BudgetZone = "green" | "yellow" | "red";

export interface BudgetConsumer {
  sourceType: string;
  tokenCount: number;
  docCount: number;
  percentage: number;
}

export interface BudgetReport {
  zone: BudgetZone;
  usagePercent: number;
  totalTokens: number;
  budget: number;
  topConsumers: BudgetConsumer[];
  recommendations: string[];
}

const GREEN_THRESHOLD = 0.6;
const YELLOW_THRESHOLD = 0.85;

function determineZone(usagePercent: number): BudgetZone {
  if (usagePercent < GREEN_THRESHOLD * 100) return "green";
  if (usagePercent < YELLOW_THRESHOLD * 100) return "yellow";
  return "red";
}

function generateRecommendations(zone: BudgetZone, consumers: BudgetConsumer[], _usagePercent: number): string[] {
  const recs: string[] = [];

  if (zone === "red") {
    recs.push("Budget critically high — consider pruning old or low-quality documents");
    if (consumers.length > 0) {
      recs.push(`Top consumer '${consumers[0].sourceType}' uses ${consumers[0].percentage}% — consider compressing or archiving`);
    }
  } else if (zone === "yellow") {
    recs.push("Budget usage approaching limit — monitor growth and consider cleanup");
  }

  // Check for source concentration
  if (consumers.length > 0 && consumers[0].percentage > 50) {
    recs.push(`Source type '${consumers[0].sourceType}' dominates at ${consumers[0].percentage}% — diversify sources`);
  }

  return recs;
}

/**
 * Generate a token budget report for the knowledge store.
 */
export function generateBudgetReport(
  db: Database.Database,
  tokenBudget: number,
): BudgetReport {
  // Get total tokens per source type
  const rows = db
    .prepare(
      "SELECT source_type, COUNT(*) as doc_count, SUM(LENGTH(content)) as total_chars FROM knowledge_documents GROUP BY source_type ORDER BY total_chars DESC",
    )
    .all() as Array<{ source_type: string; doc_count: number; total_chars: number }>;

  let totalTokens = 0;
  const consumers: BudgetConsumer[] = [];

  for (const row of rows) {
    const tokens = Math.ceil((row.total_chars ?? 0) / 4); // ~4 chars per token
    totalTokens += tokens;
    consumers.push({
      sourceType: row.source_type,
      tokenCount: tokens,
      docCount: row.doc_count,
      percentage: 0, // filled below
    });
  }

  // Calculate percentages
  for (const consumer of consumers) {
    consumer.percentage = totalTokens > 0
      ? Math.round((consumer.tokenCount / totalTokens) * 100)
      : 0;
  }

  const usagePercent = tokenBudget > 0
    ? Math.round((totalTokens / tokenBudget) * 100)
    : 0;

  const zone = determineZone(usagePercent);
  const topConsumers = consumers.slice(0, 5);
  const recommendations = generateRecommendations(zone, topConsumers, usagePercent);

  logger.debug("token-budget:report", { zone, usagePercent, totalTokens, budget: tokenBudget });

  return {
    zone,
    usagePercent,
    totalTokens,
    budget: tokenBudget,
    topConsumers,
    recommendations,
  };
}
