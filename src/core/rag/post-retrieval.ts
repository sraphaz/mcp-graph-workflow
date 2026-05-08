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
 * Post-Retrieval Pipeline — processes search results after initial retrieval.
 *
 * Pipeline stages:
 * 1. Deduplication — remove results with identical content
 * 2. Reranking — boost results with higher query keyword overlap
 * 3. Chunk stitching — merge adjacent chunks from the same source
 * 4. Limit — enforce maxResults
 */

import type Database from "better-sqlite3";
import type { SqliteStore } from "../store/sqlite-store.js";
import type { RankedResult } from "./multi-strategy-retrieval.js";
import { validateRetrievedResults, correctResults, computeBatchConfidence } from "./corrective-rag.js";
import type { BatchConfidenceSignal } from "./corrective-rag.js";
import { tokenize } from "../search/tokenizer.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "post-retrieval.ts" });

export interface PostRetrievalOptions {
  query: string;
  results: RankedResult[];
  maxResults: number;
  chunkMeta?: Map<string, number>;
  /** Optional: enable corrective validation against execution graph. */
  db?: Database.Database;
  /** Optional: SqliteStore for corrective validation. */
  store?: SqliteStore;
}

export interface PostRetrievalResult {
  results: RankedResult[];
  deduplicated: number;
  stitchedChunks: number;
  corrected: number;
  /** Aggregate confidence signal for the final result set. */
  confidenceSignal: BatchConfidenceSignal;
}

/**
 * Remove results with identical content, keeping the highest-scored one.
 */
export function deduplicateResults(results: RankedResult[]): RankedResult[] {
  const seen = new Map<string, RankedResult>();

  for (const resultValue of results) {
    const key = resultValue.content.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || resultValue.score > existing.score) {
      seen.set(key, resultValue);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

/**
 * Rerank results by keyword overlap with the query.
 * Combines original score with keyword overlap boost.
 */
export function rerankByKeywordOverlap(
  results: RankedResult[],
  query: string,
): RankedResult[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return results;

  const scored = results.map((r) => {
    const contentTokens = tokenize(r.content);
    const overlap = contentTokens.filter((t) => queryTokens.has(t)).length;
    const overlapRatio = contentTokens.length > 0 ? overlap / queryTokens.size : 0;
    // Combine: 70% original score + 30% keyword overlap
    const combinedScore = r.score * 0.7 + overlapRatio * 0.3;
    return { ...r, score: Math.round(combinedScore * 10000) / 10000 };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Merge adjacent chunks from the same source document.
 * Chunks are considered adjacent if their chunk indices differ by 1.
 */
export function stitchAdjacentChunks(
  results: RankedResult[],
  chunkMeta: Map<string, number>,
): RankedResult[] {
  if (results.length <= 1 || chunkMeta.size === 0) return results;

  // Group by sourceId
  const groups = new Map<string, RankedResult[]>();
  const ungrouped: RankedResult[] = [];

  for (const rVar of results) {
    const chunkIdx = chunkMeta.get(rVar.id);
    if (chunkIdx === undefined) {
      ungrouped.push(rVar);
      continue;
    }
    const group = groups.get(rVar.sourceId) ?? [];
    group.push(rVar);
    groups.set(rVar.sourceId, group);
  }

  const stitched: RankedResult[] = [];

  for (const [_sourceId, group] of groups) {
    // Sort by chunk index
    group.sort((a, b) => (chunkMeta.get(a.id) ?? 0) - (chunkMeta.get(b.id) ?? 0));

    let current = group[0];
    let currentIdx = chunkMeta.get(current.id) ?? 0;

    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      const nextIdx = chunkMeta.get(next.id) ?? 0;

      if (nextIdx === currentIdx + 1) {
        // Stitch: merge content, keep higher score
        current = {
          ...current,
          content: current.content + "\n\n" + next.content,
          score: Math.max(current.score, next.score),
          strategies: [...new Set([...current.strategies, ...next.strategies])],
        };
        currentIdx = nextIdx;
      } else {
        stitched.push(current);
        current = next;
        currentIdx = nextIdx;
      }
    }
    stitched.push(current);
  }

  const final = [...stitched, ...ungrouped].sort((a, b) => b.score - a.score);
  return final;
}

/**
 * Full post-retrieval pipeline.
 */
/** Run the full post-retrieval pipeline (dedup, rerank, stitch). */
export function postRetrievalPipeline(options: PostRetrievalOptions): PostRetrievalResult {
  const { query, results, maxResults, chunkMeta, db, store } = options;

  // Stage 1: Deduplication
  const deduped = deduplicateResults(results);
  const deduplicated = results.length - deduped.length;

  // Stage 2: Corrective validation (if store available)
  let correctedResults = deduped;
  let corrected = 0;
  if (db && store) {
    try {
      const validations = validateRetrievedResults(deduped, db, store);
      correctedResults = correctResults(deduped, validations);
      corrected = deduped.length - correctedResults.length;
    } catch (err) {
      log.warn("Post-retrieval corrective validation failed", { error: err instanceof Error ? err.message : String(err) });
      correctedResults = deduped;
    }
  }

  // Stage 3: Reranking
  const reranked = rerankByKeywordOverlap(correctedResults, query);

  // Stage 4: Chunk stitching (if metadata available)
  const stitched = chunkMeta
    ? stitchAdjacentChunks(reranked, chunkMeta)
    : reranked;
  const stitchedChunks = reranked.length - stitched.length;

  // Stage 5: Limit
  const limited = stitched.slice(0, maxResults);

  // Stage 6: Aggregate confidence signal — use result scores as proxy confidence
  const syntheticValidations = limited.map((r) => ({
    docId: r.id,
    isValid: r.score > 0,
    confidenceScore: Math.min(r.qualityScore, 1),
    staleness: "fresh" as const,
    issues: [] as string[],
  }));
  const confidenceSignal = computeBatchConfidence(syntheticValidations);

  log.debug("Post-retrieval pipeline complete", {
    input: results.length,
    deduplicated,
    corrected,
    stitchedChunks,
    output: limited.length,
    confidence: confidenceSignal.composite,
  });

  return { results: limited, deduplicated, stitchedChunks, corrected, confidenceSignal };
}
