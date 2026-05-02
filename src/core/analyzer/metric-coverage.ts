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
 * Metric Coverage Analyzer — checks metric monitoring coverage for high-priority risks.
 *
 * Checks:
 * - Finds metric nodes
 * - Finds risk nodes with high priority (1-2)
 * - Reports high risks without linked metrics
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface MetricCoverageReport {
  totalMetrics: number;
  totalHighRisks: number;
  coveredRisks: string[];
  uncoveredRisks: Array<{ nodeId: string; title: string; priority: number }>;
  coveragePercent: number;
}

/** analyzeMetricCoverage — auto-generated description placeholder. */
export function analyzeMetricCoverage(doc: GraphDocument): MetricCoverageReport {
  const metricNodes = doc.nodes.filter((n) => n.type === "metric");
  const highRisks = doc.nodes.filter((n) => n.type === "risk" && n.priority <= 2);

  // Build set of risk IDs that have at least one edge to/from a metric
  const metricIds = new Set(metricNodes.map((n) => n.id));
  const risksWithMetrics = new Set<string>();

  for (const edge of doc.edges) {
    // Check if edge connects a risk to a metric (either direction)
    if (metricIds.has(edge.to) && highRisks.some((r) => r.id === edge.from)) {
      risksWithMetrics.add(edge.from);
    }
    if (metricIds.has(edge.from) && highRisks.some((r) => r.id === edge.to)) {
      risksWithMetrics.add(edge.to);
    }
  }

  const coveredRisks: string[] = [];
  const uncoveredRisks: Array<{ nodeId: string; title: string; priority: number }> = [];

  for (const risk of highRisks) {
    if (risksWithMetrics.has(risk.id)) {
      coveredRisks.push(risk.id);
    } else {
      uncoveredRisks.push({ nodeId: risk.id, title: risk.title, priority: risk.priority });
    }
  }

  const coveragePercent = highRisks.length > 0
    ? Math.round((coveredRisks.length / highRisks.length) * 100)
    : 100;

  logger.debug("analyzer:metric-coverage", {
    totalMetrics: metricNodes.length,
    totalHighRisks: highRisks.length,
    covered: coveredRisks.length,
    coveragePercent,
  });

  return {
    totalMetrics: metricNodes.length,
    totalHighRisks: highRisks.length,
    coveredRisks,
    uncoveredRisks,
    coveragePercent,
  };
}
