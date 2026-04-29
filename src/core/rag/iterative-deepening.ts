/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C5 — Iterative deepening for RAG.
 * Quando primeira retrieval falha sufficiency check, expandQuery() amplia
 * o original com synonyms/broader terms (lite, sem LLM) e o caller refaz
 * uma única busca adicional. Cap em 1 expansion por chamada para evitar
 * runaway loops.
 */

export const SYNONYM_MAP: Record<string, string[]> = {
  auth: ["authentication", "authorization", "login", "session", "credential"],
  user: ["account", "profile", "member", "identity"],
  api: ["endpoint", "service", "interface"],
  error: ["failure", "exception", "fault", "bug"],
  retry: ["reattempt", "redo", "backoff"],
  cost: ["budget", "spend", "expense", "billing"],
  agent: ["worker", "executor", "process"],
  task: ["job", "work", "subtask"],
  rag: ["retrieval", "context", "knowledge"],
  budget: ["cap", "limit", "cost"],
  sprint: ["iteration", "cycle"],
  test: ["spec", "assertion", "validate"],
  hook: ["handler", "callback", "listener"],
};

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  expansionApplied: boolean;
}

/** Tokenize on whitespace, lowercase, drop single-char tokens. */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9_-]/g, ""))
    .filter((t) => t.length >= 2);
}

/**
 * Expand a query into a deduplicated list including the original plus
 * synonyms/broader terms for any token found in SYNONYM_MAP.
 */
export function expandQuery(originalQuery: string): ExpandedQuery {
  const tokens = tokenize(originalQuery);
  const expanded = new Set<string>([originalQuery]);
  for (const token of tokens) {
    const synonyms = SYNONYM_MAP[token];
    if (!synonyms) continue;
    for (const syn of synonyms) expanded.add(syn);
  }
  const list = [...expanded];
  return {
    original: originalQuery,
    expanded: list,
    expansionApplied: list.length > 1,
  };
}

export interface DocResult {
  docId: string;
  score: number;
  text?: string;
}

/** Merge two RAG result sets, deduping by docId, keeping the higher score. */
export function mergeResults<T extends DocResult>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of [...a, ...b]) {
    const prev = byId.get(r.docId);
    if (!prev || r.score > prev.score) byId.set(r.docId, r);
  }
  return [...byId.values()].sort((x, y) => y.score - x.score);
}
