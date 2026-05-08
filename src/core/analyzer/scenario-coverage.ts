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
 * Scenario Coverage Analyzer — checks how many systems are covered by scenario nodes.
 *
 * Checks:
 * - Finds all nodes with type === "scenario"
 * - Reads metadata.systemsInvolved from each scenario
 * - Compares against all epic/task titles to estimate system coverage
 * - Reports % of systems covered by at least 1 scenario
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "scenario-coverage.ts" });

export interface ScenarioCoverageReport {
  totalScenarios: number;
  systemsCovered: string[];
  systemsUncovered: string[];
  allSystems: string[];
  coveragePercent: number;
}

/** analyzeScenarioCoverage — auto-generated description placeholder. */
export function analyzeScenarioCoverage(doc: GraphDocument): ScenarioCoverageReport {
  const scenarios = doc.nodes.filter((n) => n.type === "scenario");

  // Collect all systems referenced in scenario metadata
  const coveredSystems = new Set<string>();
  for (const scenario of scenarios) {
    const meta = scenario.metadata as Record<string, unknown> | undefined;
    if (!meta) continue;
    const systems = (meta.systemsInvolved as string[]) ?? [];
    for (const sys of systems) {
      coveredSystems.add(sys.toLowerCase());
    }
  }

  // Estimate all systems from epic/task titles
  const allSystemNames = new Set<string>();
  for (const node of doc.nodes) {
    if (node.type === "epic" || node.type === "task") {
      allSystemNames.add(node.title.toLowerCase());
    }
  }

  const systemsCovered: string[] = [];
  const systemsUncovered: string[] = [];

  for (const sys of allSystemNames) {
    if (coveredSystems.has(sys)) {
      systemsCovered.push(sys);
    } else {
      systemsUncovered.push(sys);
    }
  }

  const allSystems = [...allSystemNames];
  const coveragePercent = allSystems.length > 0
    ? Math.round((systemsCovered.length / allSystems.length) * 100)
    : 100;

  log.debug("analyzer:scenario-coverage", {
    totalScenarios: scenarios.length,
    covered: systemsCovered.length,
    total: allSystems.length,
    coveragePercent,
  });

  return {
    totalScenarios: scenarios.length,
    systemsCovered,
    systemsUncovered,
    allSystems,
    coveragePercent,
  };
}
