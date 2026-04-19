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
 * Citation Chain — RAG Provenance for Anti-Hallucination
 *
 * Extracts CitationRef[] from knowledge search results,
 * enabling traceability from AI decisions back to source documents.
 *
 * Each CitationRef maps: docId → sourceType → snippet → confidence
 * so that every piece of context the agent uses can be traced.
 *
 * Part of the Autonomous Agent AAA+ pipeline — Pilar 3: Grounding.
 */

// ── Types ───────────────────────────────────────────────

export interface CitationRef {
  /** Knowledge document ID — traceable in the knowledge store */
  docId: string;
  /** Source type: memory, prd, ai_decision, docs, graph_node, etc. */
  sourceType: string;
  /** Truncated snippet of the cited content */
  snippet: string;
  /** Relevance/confidence score (0-1) */
  confidence: number;
  /** Position index in the search results (0-based) */
  chunkIndex: number;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  sourceId: string;
  score: number;
}

// ── Constants ───────────────────────────────────────────

const MAX_SNIPPET_LENGTH = 200;

// ── Extractor ───────────────────────────────────────────

/**
 * Extract CitationRef[] from knowledge search results.
 * Each result becomes a traceable citation with docId, sourceType, snippet, and confidence.
 */
export function extractCitationRefs(results: KnowledgeSearchResult[]): CitationRef[] {
  return results.map((r, index) => ({
    docId: r.id,
    sourceType: r.sourceType,
    snippet: r.content.length > MAX_SNIPPET_LENGTH
      ? r.content.slice(0, MAX_SNIPPET_LENGTH) + "..."
      : r.content,
    confidence: r.score,
    chunkIndex: index,
  }));
}
