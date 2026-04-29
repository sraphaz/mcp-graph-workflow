/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { logger } from "../utils/logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HybridCandidate {
  id: string;
  text: string;
  bm25Score: number;
  semanticScore: number | null;
  vector: number[] | null;
}

export interface HybridResult extends HybridCandidate {
  combinedScore: number;
  mmrScore: number;
}

export interface HybridSearchOptions {
  k?: number;
  lambda?: number;        // MMR λ: [0,1], higher = more relevance, less diversity (default: 0.7)
  bm25Weight?: number;    // weight in combined score (default: 0.4)
  semanticWeight?: number; // weight in combined score (default: 0.6)
}

const DEFAULT_K = 10;
const DEFAULT_LAMBDA = 0.7;
const DEFAULT_BM25_WEIGHT = 0.4;
const DEFAULT_SEMANTIC_WEIGHT = 0.6;

// ── Pure math ────────────────────────────────────────────────────────────────

export function cosineScore(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function combinedScore(
  bm25: number,
  semantic: number | null,
  bm25W: number,
  semW: number,
): number {
  if (semantic === null) return bm25;
  return bm25W * bm25 + semW * semantic;
}

// ── MMR re-ranking ────────────────────────────────────────────────────────────

export function mmrRerank(
  candidates: HybridCandidate[],
  opts: HybridSearchOptions = {},
): HybridResult[] {
  const k = opts.k ?? DEFAULT_K;
  const lambda = opts.lambda ?? DEFAULT_LAMBDA;
  const bm25W = opts.bm25Weight ?? DEFAULT_BM25_WEIGHT;
  const semW = opts.semanticWeight ?? DEFAULT_SEMANTIC_WEIGHT;

  if (candidates.length === 0) return [];

  const scored = candidates.map((c) => ({
    ...c,
    combinedScore: combinedScore(c.bm25Score, c.semanticScore, bm25W, semW),
    mmrScore: 0,
  }));

  const selected: HybridResult[] = [];
  const remaining = [...scored];

  const limit = Math.min(k, candidates.length);

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const relevance = cand.combinedScore;

      let maxSim = 0;
      if (selected.length > 0 && cand.vector) {
        for (const sel of selected) {
          if (sel.vector) {
            const sim = cosineScore(cand.vector, sel.vector);
            if (sim > maxSim) maxSim = sim;
          }
        }
      }

      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }

    const chosen = { ...remaining[bestIdx], mmrScore: bestScore };
    selected.push(chosen);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

// ── hybridSearch — main entry point ──────────────────────────────────────────

export function hybridSearch(
  candidates: HybridCandidate[],
  queryVector: number[] | null,
  opts: HybridSearchOptions = {},
): HybridResult[] {
  if (candidates.length === 0) return [];

  const hasVectors = queryVector !== null && candidates.some((c) => c.vector !== null);

  if (!hasVectors) {
    // BM25-only fallback: sort by bm25Score, return top-k with synthetic breakdown
    const k = opts.k ?? DEFAULT_K;
    const sorted = [...candidates]
      .sort((a, b) => b.bm25Score - a.bm25Score)
      .slice(0, k);

    logger.debug("hybrid-search:bm25-fallback", { count: sorted.length });

    return sorted.map((c) => ({
      ...c,
      combinedScore: c.bm25Score,
      mmrScore: c.bm25Score,
    }));
  }

  // Enrich with semantic score from queryVector
  const enriched = candidates.map((c): HybridCandidate => {
    if (c.vector && queryVector) {
      return { ...c, semanticScore: cosineScore(c.vector, queryVector) };
    }
    return c;
  });

  return mmrRerank(enriched, opts);
}
