/**
 * Knowledge Pruner — removes stale, low-quality, or old knowledge documents.
 * Strategies: age (remove old), quality (remove low-quality).
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export type PruneStrategy = "age" | "quality";

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
  }

  if (!dryRun && targetIds.length > 0) {
    const placeholders = targetIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM knowledge_documents WHERE id IN (${placeholders})`).run(...targetIds);
  }

  logger.info("knowledge-pruner:prune", {
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
