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
 * Knowledge Quality Radar — calculates quality metrics per source type
 * for rendering a radar chart in the dashboard.
 *
 * Queries KnowledgeStore for document counts and average quality scores
 * per source type. Pure function, deterministic.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "knowledge-quality-radar.ts" });

const LOW_QUALITY_THRESHOLD = 40;

export interface KnowledgeQualityMetric {
  sourceType: string;
  count: number;
  avgQuality: number;
  score: number;
  isLow: boolean;
}

/**
 * Calculate quality metrics per source type from the KnowledgeStore.
 * Returns an array of metrics sorted by source type, each with:
 * - count: number of documents
 * - avgQuality: average quality score (0-100)
 * - score: normalized score (0-100) combining count and quality
 * - isLow: true if avgQuality < 40
 */
export function calculateKnowledgeQuality(knowledgeStore: KnowledgeStore): KnowledgeQualityMetric[] {
  log.debug("knowledge-quality-radar:calculate");

  const { total, bySource } = knowledgeStore.countBySource();

  if (total === 0) return [];

  // Get average quality per source type via raw SQL
  const db = (knowledgeStore as unknown as { db: import("better-sqlite3").Database }).db;
  let avgBySource: Record<string, number> = {};
  try {
    const rows = db
      .prepare(
        "SELECT source_type, AVG(COALESCE(quality_score, 0.5)) as avg_quality FROM knowledge_documents GROUP BY source_type",
      )
      .all() as Array<{ source_type: string; avg_quality: number }>;

    for (const row of rows) {
      avgBySource[row.source_type] = row.avg_quality;
    }
  } catch {
    avgBySource = {};
  }

  const metrics: KnowledgeQualityMetric[] = [];

  for (const [sourceType, rawCount] of Object.entries(bySource)) {
    const count = Number.isFinite(rawCount) ? rawCount : 0;
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 1;
    const avgRaw = Number.isFinite(avgBySource[sourceType]) ? avgBySource[sourceType] : 0.5;
    const avgQuality = Math.round(avgRaw * 100);

    // Score combines quality and relative count contribution
    const countRatio = Math.min(count / Math.max(safeTotal * 0.2, 1), 1);
    const score = Math.round(avgQuality * 0.7 + countRatio * 100 * 0.3);

    metrics.push({
      sourceType,
      count,
      avgQuality,
      score: Math.min(score, 100),
      isLow: avgQuality < LOW_QUALITY_THRESHOLD,
    });
  }

  metrics.sort((a, b) => a.sourceType.localeCompare(b.sourceType));

  log.info("knowledge-quality-radar:done", {
    sourceTypes: metrics.length,
    totalDocs: total,
  });

  return metrics;
}
