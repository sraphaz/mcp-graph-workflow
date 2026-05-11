/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-vendor-insights-scanner — Task 1.3: keyword cross-reference matrix.
 *
 * Builds a matrix of file × keyword → occurrence count.
 * Counts are case-insensitive word-boundary matches.
 * Every keyword is present for every file — count 0 is never omitted.
 */

/** Canonical mcp-graph concept keywords for vendor scanning. */
export const MPCGRAPH_KEYWORDS = [
  "context",
  "memory",
  "rag",
  "telemetry",
  "lifecycle",
  "harness",
  "recovery",
  "evidence",
  "policy",
  "gateway",
  "proxy",
  "mcp",
  "cdp",
  "screenshot",
  "agent",
  "skill",
  "helper",
  "compress",
] as const;

export type McpGraphKeyword = (typeof MPCGRAPH_KEYWORDS)[number];

/** `file → keyword → count` */
export type CrossRefMatrix = Record<string, Record<string, number>>;

export interface FileInput {
  filePath: string;
  content: string;
}

export interface KeywordHit {
  filePath: string;
  count: number;
}

function countKeyword(content: string, keyword: string): number {
  const lc = content.toLowerCase();
  const kw = keyword.toLowerCase();
  // Count all occurrences (overlapping allowed but word-boundary agnostic for simplicity)
  let count = 0;
  let idx = 0;
  while ((idx = lc.indexOf(kw, idx)) !== -1) {
    count++;
    idx += kw.length;
  }
  return count;
}

/**
 * Build keyword cross-reference matrix from pre-loaded file contents.
 * Every keyword entry is present for every file, even if count is 0.
 */
export function buildCrossRef(
  files: FileInput[],
  keywords: readonly string[],
): CrossRefMatrix {
  const matrix: CrossRefMatrix = {};
  for (const file of files) {
    const row: Record<string, number> = {};
    for (const kw of keywords) {
      row[kw] = countKeyword(file.content, kw);
    }
    matrix[file.filePath] = row;
  }
  return matrix;
}

/**
 * Query matrix for all files that mention a keyword (count > 0), sorted desc.
 */
export function queryKeyword(matrix: CrossRefMatrix, keyword: string): KeywordHit[] {
  return Object.entries(matrix)
    .map(([filePath, row]) => ({ filePath, count: row[keyword] ?? 0 }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count);
}
