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
import { logger } from "../utils/logger.js";

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
  const result = pruneFile({
    content,
    relevantSymbols,
    preserveExports: true, // always preserve exported interfaces/types
  });

  const prunedTokens = estimateTokens(result.content);

  logger.debug("context-pruning:applied", {
    originalTokens,
    prunedTokens,
    reductionPercent: result.reductionPercent,
    preserved: result.preservedSymbols.length,
    truncated: result.truncatedSymbols.length,
  });

  return {
    prunedContent: result.content,
    summary: {
      originalTokens,
      prunedTokens,
      reductionPercent: originalTokens > 0
        ? Math.round(((originalTokens - prunedTokens) / originalTokens) * 100)
        : 0,
      symbolsPreserved: result.preservedSymbols.length,
      symbolsTruncated: result.truncatedSymbols.length,
    },
  };
}
