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
 * Citation Mapper — maps search results to citations with source traceability.
 *
 * Each chunk in the assembled context gets a [N] citation marker,
 * enabling users to trace information back to its source.
 */

import type { RankedResult } from "./multi-strategy-retrieval.js";
import { generateId } from "../utils/id.js";

export interface Citation {
  id: string;
  chunkId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  position: number;
}

export interface CitedContext {
  assembledText: string;
  citations: Citation[];
  sourceBreakdown: Record<string, number>;
}

const MAX_SNIPPET_LENGTH = 400;

/**
 * Create citations from ranked results.
 * Each result gets a position-based citation (1-indexed).
 */
export function mapCitations(results: RankedResult[]): Citation[] {
  return results.map((r, i) => ({
    id: generateId("cite"),
    chunkId: r.id,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    title: r.title,
    snippet: r.content.length > MAX_SNIPPET_LENGTH
      ? r.content.slice(0, MAX_SNIPPET_LENGTH) + "..."
      : r.content,
    relevanceScore: r.score,
    position: i + 1,
  }));
}

/**
 * Build a cited context: assembled text with [N] markers + citation list + source breakdown.
 */
export function buildCitedContext(results: RankedResult[]): CitedContext {
  if (results.length === 0) {
    return { assembledText: "", citations: [], sourceBreakdown: {} };
  }

  const citations = mapCitations(results);
  const sourceBreakdown: Record<string, number> = {};

  const textParts: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    textParts.push(`[${i + 1}] ${r.content}`);

    sourceBreakdown[r.sourceType] = (sourceBreakdown[r.sourceType] ?? 0) + 1;
  }

  const assembledText = textParts.join("\n\n");

  return { assembledText, citations, sourceBreakdown };
}
