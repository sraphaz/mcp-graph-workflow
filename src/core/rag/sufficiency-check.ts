/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C4 — RAG sufficiency threshold.
 * Pure: dado top-K results, calcula relevance médio. Se < threshold,
 * sufficiency=false e gap (terms ausentes) é exposto. Caller emite
 * knowledge:gap-detected e opcionalmente dispara graph_refresh_docs.
 */

export const SUFFICIENCY_THRESHOLD = 0.4;
export const DEFAULT_TOP_K = 5;

export interface RagResult {
  source: string;
  relevance: number;
  text?: string;
}

export interface SufficiencyCheckOptions {
  threshold?: number;
  topK?: number;
  /** Optional terms expected to appear in retrieved text → unmatched goes to gap. */
  expectedTerms?: string[];
}

export interface SufficiencyResult {
  score: number;
  sufficient: boolean;
  topK: number;
  gap: string[];
}

export function getSufficiencyThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const v = env.SUFFICIENCY_THRESHOLD ?? env.MCP_GRAPH_SUFFICIENCY_THRESHOLD;
  if (!v) return SUFFICIENCY_THRESHOLD;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : SUFFICIENCY_THRESHOLD;
}

export function computeSufficiency(
  results: RagResult[],
  opts: SufficiencyCheckOptions = {},
): SufficiencyResult {
  const threshold = opts.threshold ?? SUFFICIENCY_THRESHOLD;
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const considered = results.slice(0, topK);

  const score =
    considered.length === 0
      ? 0
      : considered.reduce((sum, r) => sum + r.relevance, 0) / considered.length;

  const gap: string[] = [];
  if (opts.expectedTerms && opts.expectedTerms.length > 0) {
    const corpus = considered
      .map((r) => r.text ?? "")
      .join(" ")
      .toLowerCase();
    for (const term of opts.expectedTerms) {
      if (!corpus.includes(term.toLowerCase())) gap.push(term);
    }
  }

  return {
    score,
    sufficient: score >= threshold,
    topK: considered.length,
    gap,
  };
}

export function isAutoDocSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_AUTO_DOC_SYNC === "true";
}
