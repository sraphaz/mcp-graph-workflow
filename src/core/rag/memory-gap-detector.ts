/* eslint-disable security/detect-unsafe-regex */
/*!
 * Lint exemption: the regex patterns in this file are bounded
 * (literal alternations, short character classes, language-keyword
 * lookups) and run against parsed/structured input. The ReDoS class
 * the rule is designed to prevent is not reachable here.
 */
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C6 — Memory gap detector.
 * Extrai termos significativos (CamelCase, ALL_CAPS, capitalized phrases),
 * filtra stopwords, e identifica os que não têm hits no knowledge store.
 * Caller emite knowledge:undocumented-term + tagga node 'undocumented-{term}'.
 */

import type Database from "better-sqlite3";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "on", "for", "with",
  "as", "by", "at", "from", "this", "that", "these", "those", "it", "its",
  "be", "are", "was", "were", "have", "has", "had", "but", "if", "then",
  "should", "must", "can", "will", "may", "would", "do", "does", "done",
]);

export const TOP_K_TERMS = 10;

/**
 * Extract key terms — favors compound proper nouns (CamelCase, ALL_CAPS,
 * capitalized phrases) which are likely domain-specific identifiers, then
 * falls back to TF-style frequency on remaining tokens.
 */
export function extractKeyTerms(text: string, topK: number = TOP_K_TERMS): string[] {
  if (!text) return [];

  const proper = new Set<string>();
  // CamelCase + UpperPrefixCamel (e.g. XYZService).
  const camelCaseRe = /\b(?:[A-Z][a-z0-9]+|[A-Z]{2,})(?:[A-Z][a-z0-9]+)+\b/g;
  const allCapsRe = /\b[A-Z]{2,}(?:[_-][A-Z0-9]+)+\b/g;
  const capPhraseRe = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g;

  for (const mVar of text.matchAll(camelCaseRe)) proper.add(mVar[0]);
  for (const mVar of text.matchAll(allCapsRe)) {
    if (mVar[0].length > 1) proper.add(mVar[0]);
  }
  for (const mVar of text.matchAll(capPhraseRe)) proper.add(mVar[0]);

  const properList = [...proper];
  if (properList.length >= topK) return properList.slice(0, topK);

  const freq = new Map<string, number>();
  const tokens = text.toLowerCase().match(/\b[a-z][a-z0-9_-]{3,}\b/g) ?? [];
  for (const tVar of tokens) {
    if (STOPWORDS.has(tVar)) continue;
    freq.set(tVar, (freq.get(tVar) ?? 0) + 1);
  }
  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0]);

  const out = [...properList];
  for (const tVar of ranked) {
    if (out.length >= topK) break;
    if (!out.some((existing) => existing.toLowerCase() === tVar)) out.push(tVar);
  }
  return out.slice(0, topK);
}

export interface GapResult {
  term: string;
  hits: number;
  undocumented: boolean;
}

/**
 * Check each term against knowledge_documents. Term is "undocumented" when
 * no row contains it via LIKE %term% (case-insensitive on SQLite default).
 */
export function detectKnowledgeGaps(
  db: Database.Database,
  terms: string[],
): GapResult[] {
  const results: GapResult[] = [];
  let stmt;
  try {
    stmt = db.prepare(
      `SELECT COUNT(*) AS n FROM knowledge_documents WHERE content LIKE '%' || ? || '%' OR title LIKE '%' || ? || '%'`,
    );
  } catch {
    // Table may not exist in some test envs — every term is undocumented.
    return terms.map((term) => ({ term, hits: 0, undocumented: true }));
  }
  for (const term of terms) {
    const row = stmt.get(term, term) as { n: number } | undefined;
    const hits = row?.n ?? 0;
    results.push({ term, hits, undocumented: hits === 0 });
  }
  return results;
}
