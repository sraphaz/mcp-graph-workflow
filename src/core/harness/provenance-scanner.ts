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
 * Provenance Scanner — 8th harness dimension.
 *
 * Measures what proportion of graph nodes have a provenance receipt (source_file),
 * meaning they were imported from a traceable PRD or source document.
 *
 * Score = (nodes with non-null source_file / total nodes) * 100.
 * Returns 0 when there are no nodes.
 */

import type Database from "better-sqlite3";

export interface ProvenanceScanResult {
  provenanceScore: number;
  totalNodes: number;
  nodesWithReceipt: number;
}

/**
 * Scan the graph DB for nodes with a traceable provenance receipt (source_file).
 * A valid receipt = source_file IS NOT NULL AND source_file != ''.
 */
export function scanProvenance(db: Database.Database): ProvenanceScanResult {
  const totalRow = db.prepare("SELECT COUNT(*) as cnt FROM nodes").get() as { cnt: number };
  const total = totalRow.cnt;

  if (total === 0) {
    // No nodes to measure — score 100 (not penalized, nothing to trace)
    return { provenanceScore: 100, totalNodes: 0, nodesWithReceipt: 0 };
  }

  const receiptRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM nodes WHERE source_file IS NOT NULL AND source_file != ''",
  ).get() as { cnt: number };

  const withReceipt = receiptRow.cnt;
  const score = Math.round((withReceipt / total) * 100);

  return { provenanceScore: score, totalNodes: total, nodesWithReceipt: withReceipt };
}
