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
 * Doc Completeness Checker — validates documentation coverage for handoff.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { DocCompletenessReport } from "../../schemas/handoff-schema.js";
import { logger } from "../utils/logger.js";

/** Check description coverage across all graph nodes. */
export function checkDocCompleteness(doc: GraphDocument): DocCompletenessReport {
  const { nodes } = doc;

  const withDescription = nodes.filter((n) => n.description && n.description.trim().length > 0);
  const withoutDescription = nodes.filter((n) => !n.description || n.description.trim().length === 0);

  const totalNodes = nodes.length;
  const descriptionsPresent = withDescription.length;
  const coverageRate = totalNodes > 0 ? Math.round((descriptionsPresent / totalNodes) * 100) : 100;

  const nodesWithoutDescription = withoutDescription.map((n) => ({
    nodeId: n.id,
    title: n.title,
  }));

  logger.info("doc-completeness", { coverageRate, totalNodes, descriptionsPresent });

  return { descriptionsPresent, totalNodes, coverageRate, nodesWithoutDescription };
}
