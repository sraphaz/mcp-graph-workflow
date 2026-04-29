/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T06 — Memory dedup detector.
 * Pure cosine similarity check. Caller (hook memory:post-store) gera
 * embedding do novo memory + slice dos últimos N existentes; este módulo
 * decide se há near-duplicate (similarity >= threshold).
 */

export const DEDUP_SIMILARITY_THRESHOLD = 0.85;
export const DEFAULT_DEDUP_WINDOW = 100;
export const MIN_DEDUP_CONTENT_LEN = 50;

export interface MemoryEmbedding {
  id: string;
  vector: number[];
}

export interface DedupCandidate {
  existingId: string;
  similarity: number;
}

export function isMemoryDedupDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_MEMORY_DEDUP === "off";
}

export function getDedupWindow(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MCP_GRAPH_DEDUP_WINDOW;
  if (!raw) return DEFAULT_DEDUP_WINDOW;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DEDUP_WINDOW;
}

export function shouldSkipDedup(content: string): boolean {
  return !content || content.length < MIN_DEDUP_CONTENT_LEN;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Find near-duplicates above threshold against the candidate window.
 * Returns matches sorted by similarity DESC.
 */
export function findNearDuplicates(
  newEmbedding: MemoryEmbedding,
  existing: MemoryEmbedding[],
  threshold: number = DEDUP_SIMILARITY_THRESHOLD,
): DedupCandidate[] {
  const matches: DedupCandidate[] = [];
  for (const ex of existing) {
    if (ex.id === newEmbedding.id) continue;
    const sim = cosineSimilarity(newEmbedding.vector, ex.vector);
    if (sim >= threshold) {
      matches.push({ existingId: ex.id, similarity: sim });
    }
  }
  return matches.sort((a, b) => b.similarity - a.similarity);
}
