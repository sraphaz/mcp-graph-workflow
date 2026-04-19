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
 * Config Coverage Analyzer — checks config schema coverage.
 *
 * Checks:
 * - Finds config_schema nodes
 * - Checks metadata.referencedBy exists and is non-empty
 * - Reports orphan configs (no references) and referenced-but-undefined configs
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface ConfigCoverageReport {
  totalConfigs: number;
  orphanConfigs: Array<{ nodeId: string; title: string }>;
  referencedButUndefined: string[];
  coveragePercent: number;
}

export function analyzeConfigCoverage(doc: GraphDocument): ConfigCoverageReport {
  const configNodes = doc.nodes.filter((n) => n.type === "config_schema");
  const configIds = new Set(configNodes.map((n) => n.id));

  const orphanConfigs: Array<{ nodeId: string; title: string }> = [];
  const allReferencedBy = new Set<string>();

  for (const node of configNodes) {
    const meta = node.metadata as Record<string, unknown> | undefined;
    const referencedBy = (meta?.referencedBy as string[]) ?? [];

    if (referencedBy.length === 0) {
      orphanConfigs.push({ nodeId: node.id, title: node.title });
    }

    for (const ref of referencedBy) {
      allReferencedBy.add(ref);
    }
  }

  // Find config names referenced by tasks/descriptions but not defined as config_schema nodes
  const referencedButUndefined: string[] = [];
  for (const ref of allReferencedBy) {
    if (!configIds.has(ref)) {
      referencedButUndefined.push(ref);
    }
  }

  const referencedCount = configNodes.length - orphanConfigs.length;
  const coveragePercent = configNodes.length > 0
    ? Math.round((referencedCount / configNodes.length) * 100)
    : 100;

  logger.debug("analyzer:config-coverage", {
    totalConfigs: configNodes.length,
    orphans: orphanConfigs.length,
    undefined: referencedButUndefined.length,
    coveragePercent,
  });

  return {
    totalConfigs: configNodes.length,
    orphanConfigs,
    referencedButUndefined,
    coveragePercent,
  };
}
