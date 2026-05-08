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
 * Knowledge Pruner — removes stale, low-quality, or old knowledge documents.
 * Strategies: age (remove old), quality (remove low-quality).
 */

import type Database from "better-sqlite3";
import { createLogger } from "../utils/logger.js";
import { findDuplicates } from "./knowledge-dedup.js";

const log = createLogger({ layer: "rag", source: "knowledge-pruner.ts" });

export type PruneStrategy = "age" | "quality" | "dedup";

export interface PruneOptions {
  strategy: PruneStrategy;
  maxAgeDays?: number;
  minQuality?: number;
  dryRun: boolean;
}

export interface PruneResult {
  pruned: number;
  prunedIds: string[];
  dryRun: boolean;
  strategy: PruneStrategy;
}

/**
 * Prune knowledge documents based on strategy.
 */
export function pruneKnowledge(
  db: Database.Database,
  options: PruneOptions,
): PruneResult {
  const { strategy, dryRun } = options;

  let targetIds: string[] = [];

  if (strategy === "age") {
    const maxAge = options.maxAgeDays ?? 90;
    const rows = db
      .prepare(
        "SELECT id FROM knowledge_documents WHERE staleness_days > ?",
      )
      .all(maxAge) as Array<{ id: string }>;
    targetIds = rows.map((r) => r.id);
  } else if (strategy === "quality") {
    const minQuality = options.minQuality ?? 0.3;
    const rows = db
      .prepare(
        "SELECT id FROM knowledge_documents WHERE quality_score < ?",
      )
      .all(minQuality) as Array<{ id: string }>;
    targetIds = rows.map((r) => r.id);
  } else if (strategy === "dedup") {
    const duplicates = findDuplicates(db);
    // For each duplicate pair, keep the newer doc (docId1 from ORDER BY created_at DESC)
    // and mark the older one (docId2) for deletion
    const toDelete = new Set<string>();
    for (const pair of duplicates) {
      toDelete.add(pair.docId2);
    }
    targetIds = [...toDelete];
  }

  if (!dryRun && targetIds.length > 0) {
    const placeholders = targetIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM knowledge_documents WHERE id IN (${placeholders})`).run(...targetIds);
  }

  log.info("knowledge-pruner:prune", {
    strategy,
    dryRun,
    pruned: targetIds.length,
  });

  return {
    pruned: targetIds.length,
    prunedIds: targetIds,
    dryRun,
    strategy,
  };
}
