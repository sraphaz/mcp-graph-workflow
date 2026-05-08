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
 * REM Phase — Priority Processing + Merge + Association Strengthening
 *
 * Biological basis:
 * - Emotional Memory Processing (Stickgold 2005): amygdala selectively
 *   strengthens priority memories while decoupling emotional charge.
 * - Pattern Integration (McClelland 1995): complementary learning systems
 *   merge similar representations across stores.
 * - Theta Oscillations (Buzsáki 2002): co-accessed items get their
 *   associations strengthened via phase-coupled binding.
 */

import type Database from "better-sqlite3";
import type { DreamCycleConfig, RemPhaseResult } from "../dream-types.js";
import { linkBySharedContext } from "../../rag/knowledge-linker.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger({ layer: "core", source: "rem-phase.ts" });

interface DocRow {
  id: string;
  quality_score: number | null;
  metadata: string | null;
}

/** Minimal interface for embedding-based similarity — matches EmbeddingStore subset. */
export interface RemEmbeddingProvider {
  count(): number;
  findSimilar(queryVector: number[], limit: number): Array<{ id: string; similarity: number }>;
  getById(id: string): { id: string; embedding: number[] } | null;
  getAllIds(): string[];
}

const MERGE_SIMILARITY_THRESHOLD = 0.92;

/**
 * Source types that are safe to soft-merge (ephemeral, regenerable).
 * Everything else is protected — never touched by the merge process.
 */
const MERGEABLE_SOURCE_TYPES = new Set([
  "docs",
  "code_context",
  "benchmark",
  "capture",
]);

/** Score penalty applied to soft-merged duplicates instead of deleting them. */
const MERGE_QUALITY_DECAY = 0.3;

/**
 * Run the REM phase of a dream cycle.
 *
 * 1. Priority Processing: boost blocker/error docs, decay urgency
 * 2. Merge: find and merge highly similar docs via embedding similarity
 * 3. Association: strengthen links between co-accessed docs
 */
export function runRemPhase(
  db: Database.Database,
  config: DreamCycleConfig,
  _cycleId: string,
  embeddingProvider?: RemEmbeddingProvider,
): RemPhaseResult {
  const startMs = Date.now();

  // ── 1. Priority Processing ──────────────────────────────
  const { priorityProcessed, urgencyDecayed } = processPriorityDocs(db, config);

  // ── 2. Semantic Merge via embedding similarity ──────────
  let merged = 0;
  let clustersFormed = 0;
  if (embeddingProvider && embeddingProvider.count() > 0 && !config.dryRun) {
    const mergeResult = mergeBySemanticSimilarity(db, embeddingProvider);
    merged = mergeResult.merged;
    clustersFormed = mergeResult.clustersFormed;
  }

  // ── 3. Association Strengthening ───────────────────────
  let associationsCreated = 0;
  if (!config.dryRun) {
    const linkResult = linkBySharedContext(db);
    associationsCreated = linkResult.relationsCreated;
  }

  const durationMs = Date.now() - startMs;
  log.info("dream:rem:complete", { priorityProcessed, urgencyDecayed, merged, associationsCreated, durationMs });

  return { priorityProcessed, urgencyDecayed, merged, clustersFormed, associationsCreated, durationMs };
}

interface MergeableDocRow {
  id: string;
  source_type: string;
  quality_score: number | null;
  metadata: string | null;
}

/**
 * Safe semantic merge — soft-merges similar docs with guardrails:
 *
 * 1. Only merges MERGEABLE_SOURCE_TYPES (docs, code_context, benchmark, capture).
 *    Protected types (prd, memory, ai_decision, phase_summary, sprint_plan) are never touched.
 * 2. Soft-merge via metadata flag (merged_into: <kept_id>) + quality score decay.
 *    No hard deletes — information is preserved for audit.
 * 3. Decayed docs get lower RAG ranking but remain queryable.
 */
function mergeBySemanticSimilarity(
  db: Database.Database,
  provider: RemEmbeddingProvider,
): { merged: number; clustersFormed: number } {
  const allIds = provider.getAllIds();
  const mergedIds = new Set<string>();
  let merged = 0;
  let clustersFormed = 0;

  // Pre-load source types for all docs to check mergeability
  const docLookup = db.prepare(
    "SELECT id, source_type, quality_score, metadata FROM knowledge_documents WHERE id = ?",
  );
  const updateMerged = db.prepare(
    "UPDATE knowledge_documents SET quality_score = ?, metadata = ? WHERE id = ?",
  );

  for (const id of allIds) {
    if (mergedIds.has(id)) continue;

    const entry = provider.getById(id);
    if (!entry) continue;

    // Check if the source doc is mergeable
    const sourceDoc = docLookup.get(id) as MergeableDocRow | undefined;
    if (!sourceDoc || !MERGEABLE_SOURCE_TYPES.has(sourceDoc.source_type)) continue;

    const similar = provider.findSimilar(entry.embedding, 5);
    const cluster: string[] = [];

    for (const match of similar) {
      if (match.id === id) continue;
      if (mergedIds.has(match.id)) continue;
      if (match.similarity < MERGE_SIMILARITY_THRESHOLD) continue;

      // Check if the match is also a mergeable type
      const matchDoc = docLookup.get(match.id) as MergeableDocRow | undefined;
      if (!matchDoc || !MERGEABLE_SOURCE_TYPES.has(matchDoc.source_type)) continue;

      // Soft-merge: decay quality score + set merged_into metadata
      const currentScore = matchDoc.quality_score ?? 0.5;
      const decayedScore = Math.max(0, currentScore - MERGE_QUALITY_DECAY);

      let meta: Record<string, unknown> = {};
      try {
        if (matchDoc.metadata) meta = JSON.parse(matchDoc.metadata) as Record<string, unknown>;
      } catch {
        log.warn("rem-phase:corrupted-metadata", { docId: match.id });
      }
      meta.merged_into = id;
      meta.merged_at = new Date().toISOString();
      meta.pre_merge_score = currentScore;

      updateMerged.run(decayedScore, JSON.stringify(meta), match.id);
      mergedIds.add(match.id);
      cluster.push(match.id);
      merged++;
    }

    if (cluster.length > 0) {
      clustersFormed++;
      log.debug("dream:rem:merge_cluster", { kept: id, softMerged: cluster, sourceType: sourceDoc.source_type });
    }
  }

  return { merged, clustersFormed };
}

/**
 * Priority Processing: find docs with metadata.priority = "blocker" or "error".
 * Boost their quality_score by +0.15 (capped at 1.0).
 * Decay urgency metadata field by urgencyDecayFactor.
 */
function processPriorityDocs(
  db: Database.Database,
  config: DreamCycleConfig,
): { priorityProcessed: number; urgencyDecayed: number } {
  const docs = db
    .prepare("SELECT id, quality_score, metadata FROM knowledge_documents WHERE metadata IS NOT NULL")
    .all() as DocRow[];

  let priorityProcessed = 0;
  let urgencyDecayed = 0;

  const updateScore = db.prepare("UPDATE knowledge_documents SET quality_score = ? WHERE id = ?");
  const updateMeta = db.prepare("UPDATE knowledge_documents SET metadata = ? WHERE id = ?");

  db.transaction(() => {
    for (const doc of docs) {
      if (!doc.metadata) continue;

      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(doc.metadata) as Record<string, unknown>;
      } catch {
        log.warn("rem-phase:corrupted-metadata-boost", { docId: doc.id });
        continue;
      }

      const priority = meta.priority as string | undefined;

      // Boost quality for priority items
      if (priority === "blocker" || priority === "error") {
        const currentScore = doc.quality_score ?? 0.5;
        const boostedScore = Math.min(1.0, currentScore + 0.15);
        if (!config.dryRun) {
          updateScore.run(boostedScore, doc.id);
        }
        priorityProcessed++;
      }

      // Decay urgency field
      if (typeof meta.urgency === "number" && meta.urgency > 0) {
        meta.urgency = meta.urgency * config.urgencyDecayFactor;
        if (!config.dryRun) {
          updateMeta.run(JSON.stringify(meta), doc.id);
        }
        urgencyDecayed++;
      }
    }
  })();

  log.debug("dream:rem:priority", { priorityProcessed, urgencyDecayed });
  return { priorityProcessed, urgencyDecayed };
}
