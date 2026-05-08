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
 * Context Pruning Integration — AST-Pruner for Context Assembler
 *
 * Bridge between the AST-Pruner and the Context Assembler.
 * Applies Shannon Information Theory pruning to code sections
 * in the context pipeline, reducing token usage in Tier 3 (deep).
 *
 * Based on: Parnas Information Hiding applied to LLM context.
 */

import { pruneFile } from "./ast-pruner.js";
import { estimateTokens } from "./token-estimator.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "context-pruning.ts" });

// ── Types ───────────────────────────────────────────────

export interface PruningSummary {
  originalTokens: number;
  prunedTokens: number;
  reductionPercent: number;
  symbolsPreserved: number;
  symbolsTruncated: number;
}

export interface PruneResult {
  prunedContent: string;
  summary: PruningSummary;
}

// ── Heuristic: is this TypeScript code? ─────────────────

const TS_INDICATORS = [
  /^import\s+/m,
  /^export\s+(function|class|interface|type|const|enum)/m,
  // eslint-disable-next-line security/detect-unsafe-regex -- bounded by line content
  /^(async\s+)?function\s+\w+/m,
  /^class\s+\w+/m,
];

function looksLikeTypeScript(content: string): boolean {
  return TS_INDICATORS.some((pattern) => pattern.test(content));
}

// ── Public API ──────────────────────────────────────────

/**
 * Prune a context section's content if it looks like TypeScript code.
 *
 * @param content - The raw content to potentially prune
 * @param relevantSymbols - Symbol names to preserve (from query terms)
 * @param enabled - If false, returns content unchanged (default: true)
 */
export function pruneContextSection(
  content: string,
  relevantSymbols: string[],
  enabled: boolean = true,
): PruneResult {
  const originalTokens = estimateTokens(content);

  // Disabled = pass-through
  if (!enabled) {
    return {
      prunedContent: content,
      summary: {
        originalTokens,
        prunedTokens: originalTokens,
        reductionPercent: 0,
        symbolsPreserved: 0,
        symbolsTruncated: 0,
      },
    };
  }

  // Only prune content that looks like TypeScript
  if (!looksLikeTypeScript(content)) {
    return {
      prunedContent: content,
      summary: {
        originalTokens,
        prunedTokens: originalTokens,
        reductionPercent: 0,
        symbolsPreserved: 0,
        symbolsTruncated: 0,
      },
    };
  }

  // Apply AST-Pruning
  const resultValue = pruneFile({
    content,
    relevantSymbols,
    preserveExports: true, // always preserve exported interfaces/types
  });

  const prunedTokens = estimateTokens(resultValue.content);

  log.debug("context-pruning:applied", {
    originalTokens,
    prunedTokens,
    reductionPercent: resultValue.reductionPercent,
    preserved: resultValue.preservedSymbols.length,
    truncated: resultValue.truncatedSymbols.length,
  });

  return {
    prunedContent: resultValue.content,
    summary: {
      originalTokens,
      prunedTokens,
      reductionPercent: originalTokens > 0
        ? Math.round(((originalTokens - prunedTokens) / originalTokens) * 100)
        : 0,
      symbolsPreserved: resultValue.preservedSymbols.length,
      symbolsTruncated: resultValue.truncatedSymbols.length,
    },
  };
}
