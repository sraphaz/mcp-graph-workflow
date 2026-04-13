/**
 * PRF Query Expander — Pseudo-Relevance Feedback query expansion.
 *
 * Based on Rocchio (1971) and RM3 (Lavrenko & Croft, 2001).
 * Retrieves top-K docs, extracts discriminative TF-IDF terms,
 * and appends them to the original query.
 *
 * Pure function — retriever is injected for testability.
 */

import { tokenize } from "../search/tokenizer.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface QueryExpansionConfig {
  /** Enable/disable expansion. Default: true */
  enabled?: boolean;
  /** Number of top docs to use for feedback. Default: 3 */
  topK?: number;
  /** Max expansion terms to add. Default: 5 */
  maxTerms?: number;
  /** Weight of expansion terms relative to original. Default: 0.5 (not used in string concat, reserved for weighted scoring) */
  alpha?: number;
}

export interface QueryExpansionResult {
  expandedQuery: string;
  addedTerms: string[];
  expanded: boolean;
}

/** Retriever function: given a query and limit, returns docs with title + content. */
export type DocRetriever = (query: string, limit: number) => Array<{ title: string; content: string }>;

const DEFAULT_CONFIG: Required<QueryExpansionConfig> = {
  enabled: true,
  topK: 3,
  maxTerms: 5,
  alpha: 0.5,
};

// ── Core Function ───────────────────────────────────────

/**
 * Expand a query using Pseudo-Relevance Feedback.
 *
 * 1. Retrieve top-K docs using the original query
 * 2. Extract top-N discriminative TF-IDF terms from retrieved docs
 *    (excluding terms already in the original query)
 * 3. Append expansion terms to the original query
 */
export function expandQuery(
  query: string,
  retriever: DocRetriever,
  config?: QueryExpansionConfig,
): QueryExpansionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Feature flag check
  if (!cfg.enabled) {
    return { expandedQuery: query, addedTerms: [], expanded: false };
  }

  // Retrieve top docs
  let docs: Array<{ title: string; content: string }>;
  try {
    docs = retriever(query, cfg.topK);
  } catch {
    logger.debug("query-expander: retriever failed, returning original query");
    return { expandedQuery: query, addedTerms: [], expanded: false };
  }

  if (docs.length === 0) {
    return { expandedQuery: query, addedTerms: [], expanded: false };
  }

  // Tokenize original query to exclude those terms
  const originalTerms = new Set(
    tokenize(query, { stopwords: true, accentStrip: true }).map((t) => t.toLowerCase()),
  );

  // Extract TF-IDF terms from retrieved docs
  const expansionTerms = extractDiscriminativeTerms(docs, originalTerms, cfg.maxTerms);

  if (expansionTerms.length === 0) {
    return { expandedQuery: query, addedTerms: [], expanded: false };
  }

  // Build expanded query: original + expansion terms
  const expandedQuery = `${query} ${expansionTerms.join(" ")}`;

  logger.debug("query-expander:expanded", {
    original: query,
    addedTerms: expansionTerms,
    docCount: docs.length,
  });

  return {
    expandedQuery,
    addedTerms: expansionTerms,
    expanded: true,
  };
}

// ── TF-IDF Term Extraction ──────────────────────────────

/**
 * Extract top discriminative terms from a set of docs using TF-IDF.
 * Excludes terms already present in the original query.
 */
function extractDiscriminativeTerms(
  docs: Array<{ title: string; content: string }>,
  excludeTerms: Set<string>,
  maxTerms: number,
): string[] {
  // Build per-doc term frequency and global document frequency
  const docFreq = new Map<string, number>();
  const docTermFreqs: Array<Map<string, number>> = [];
  const docLengths: number[] = [];

  for (const doc of docs) {
    const text = `${doc.title} ${doc.content}`;
    const tokens = tokenize(text, { stopwords: true, accentStrip: true })
      .map((t) => t.toLowerCase());
    const tf = new Map<string, number>();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // Document frequency
    for (const term of tf.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }

    docTermFreqs.push(tf);
    docLengths.push(tokens.length || 1);
  }

  const n = docs.length;

  // Score each term by average TF-IDF across documents
  const termScores = new Map<string, number>();
  for (const [term, df] of docFreq) {
    // Skip terms already in the query
    if (excludeTerms.has(term)) continue;
    // Skip very short terms
    if (term.length < 3) continue;

    const idf = Math.log(1 + n / df);
    let totalTfIdf = 0;

    for (let i = 0; i < docTermFreqs.length; i++) {
      const tf = (docTermFreqs[i].get(term) ?? 0) / docLengths[i];
      totalTfIdf += tf * idf;
    }

    termScores.set(term, totalTfIdf / n);
  }

  // Sort by score descending and take top N
  return [...termScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term]) => term);
}
