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
 * PRD Indexer — indexes PRD text content into the knowledge store
 * so that original requirements can be queried in later lifecycle phases.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

export interface PrdIndexResult {
  documentsIndexed: number;
  sourceFile: string;
  /** §BUG-02 — count of pre-existing docs evicted to keep the store within budget. */
  pruned: number;
}

export interface PrdIndexOptions {
  /**
   * §BUG-02 — soft cap on total docs in the knowledge store after insert.
   * When exceeded, the lowest-quality / least-used / oldest docs are evicted
   * via knowledgeStore.autoprune(budget). 0 disables enforcement (legacy).
   * Recommended: 200–500 for typical projects.
   */
  budget?: number;
}

/**
 * §BUG-02-B — Quality score per PRD chunk.
 * Base = min(1.0, length/500). Bonus = +0.2 when GIVEN/WHEN/THEN/must/shall
 * keywords are present (signals testable AC / requirement language).
 * Capped at 1.0.
 */
function computeChunkQuality(content: string): number {
  const base = Math.min(1.0, content.length / 500);
  const hasKeyword = /\b(GIVEN|WHEN|THEN|must|shall)\b/i.test(content);
  return Math.min(1.0, base + (hasKeyword ? 0.2 : 0));
}

/**
 * Index PRD text content into the knowledge store.
 * Chunks the content and stores with source_type='prd'.
 */
export function indexPrdContent(
  knowledgeStore: KnowledgeStore,
  content: string,
  sourceFile: string,
  phase?: LifecyclePhase,
  options: PrdIndexOptions = {},
): PrdIndexResult {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    logger.info("No content to index from PRD", { sourceFile });
    return { documentsIndexed: 0, sourceFile, pruned: 0 };
  }

  const sourceId = `prd:${sourceFile}`;

  // Remove previous version to re-index fresh content
  knowledgeStore.deleteBySource("prd", sourceId);

  const docs = knowledgeStore.insertChunks(
    chunks.map((chunk) => ({
      sourceType: "prd" as const,
      sourceId,
      title: chunks.length > 1
        ? `PRD: ${sourceFile} [${chunk.index + 1}/${chunks.length}]`
        : `PRD: ${sourceFile}`,
      content: chunk.content,
      chunkIndex: chunk.index,
      metadata: {
        sourceFile,
        phase: phase ?? "ANALYZE",
        indexedAt: new Date().toISOString(),
      },
      qualityScore: computeChunkQuality(chunk.content),
    })),
  );

  // §BUG-02 — enforce store budget after insert so that chained import_prd
  // calls do not blow the context-RAG economics. Eviction is selective
  // (lowest-quality first) and never touches the chunks just inserted in
  // the common case where docs.length <= budget.
  let pruned = 0;
  if (options.budget && options.budget > 0) {
    const resultValue = knowledgeStore.autoprune(options.budget);
    pruned = resultValue.removed;
    if (pruned > 0) {
      logger.info("PRD index budget enforced", { sourceFile, budget: options.budget, pruned });
    }
  }

  logger.info("PRD content indexed", { sourceFile, chunks: docs.length, pruned });

  return { documentsIndexed: docs.length, sourceFile, pruned };
}
