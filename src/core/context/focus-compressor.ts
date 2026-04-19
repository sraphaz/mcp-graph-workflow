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
 * Focus Compressor — topic-guided context compression.
 * Scores sections by BM25 relevance to a focus topic, preserves high-relevance
 * sections verbatim and compresses low-relevance ones.
 * Inspired by hermes-agent guided compression.
 */

import { rankChunksByBm25 } from "./bm25-compressor.js";
import { compressText } from "./compress-text.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

export type PressureLevel = "none" | "medium" | "high" | "critical";

export interface FocusCompressStats {
  inputTokens: number;
  outputTokens: number;
  sectionsTotal: number;
  sectionsPreserved: number;
  sectionsCompressed: number;
  reductionPercent: number;
}

export interface FocusCompressResult {
  compressed: string;
  stats: FocusCompressStats;
  focusRelevanceScore: number;
  pressureLevel: PressureLevel;
}

/** Minimum compression floor — never compress below this fraction of original. */
const COMPRESSION_FLOOR = 0.2;

/** Pressure thresholds (percent of budget used by input). */
const PRESSURE_THRESHOLDS = {
  medium: 0.50,
  high: 0.75,
  critical: 0.90,
};

/**
 * Split text into sections by headings (##) or double newlines.
 */
function splitIntoSections(text: string): string[] {
  // Split on markdown headings or double newlines
  const sections = text.split(/(?=^##\s)/m).filter((s) => s.trim().length > 0);
  if (sections.length <= 1) {
    // No heading-based sections, split on double newlines
    return text.split(/\n\n+/).filter((s) => s.trim().length > 0);
  }
  return sections;
}

/**
 * Determine pressure level based on input tokens vs budget.
 */
function calculatePressure(inputTokens: number, budgetTokens: number): PressureLevel {
  if (budgetTokens <= 0) return "critical";
  const ratio = inputTokens / budgetTokens;
  if (ratio >= PRESSURE_THRESHOLDS.critical) return "critical";
  if (ratio >= PRESSURE_THRESHOLDS.high) return "high";
  if (ratio >= PRESSURE_THRESHOLDS.medium) return "medium";
  return "none";
}

/**
 * Compress text with topic-guided focus.
 * High-relevance sections are preserved; low-relevance sections are compressed.
 */
export function compressWithFocus(
  text: string,
  focusTopic: string,
  maxTokens: number,
): FocusCompressResult {
  const inputTokens = estimateTokens(text);

  // Empty input
  if (!text.trim() || inputTokens === 0) {
    return {
      compressed: "",
      stats: { inputTokens: 0, outputTokens: 0, sectionsTotal: 0, sectionsPreserved: 0, sectionsCompressed: 0, reductionPercent: 0 },
      focusRelevanceScore: 0,
      pressureLevel: "none",
    };
  }

  // Empty focus — return as-is within budget
  if (!focusTopic.trim()) {
    const compressed = inputTokens <= maxTokens ? text : compressText(text, "summary", maxTokens).compressed;
    const outputTokens = estimateTokens(compressed);
    return {
      compressed,
      stats: { inputTokens, outputTokens, sectionsTotal: 1, sectionsPreserved: 1, sectionsCompressed: 0, reductionPercent: Math.round((1 - outputTokens / inputTokens) * 100) },
      focusRelevanceScore: 0,
      pressureLevel: calculatePressure(inputTokens, maxTokens),
    };
  }

  const pressureLevel = calculatePressure(inputTokens, maxTokens);
  const sections = splitIntoSections(text);

  // If already within budget, return as-is
  if (inputTokens <= maxTokens) {
    const ranked = rankChunksByBm25(sections, focusTopic);
    const avgScore = ranked.length > 0 ? ranked.reduce((s, r) => s + r.score, 0) / ranked.length : 0;
    return {
      compressed: text,
      stats: { inputTokens, outputTokens: inputTokens, sectionsTotal: sections.length, sectionsPreserved: sections.length, sectionsCompressed: 0, reductionPercent: 0 },
      focusRelevanceScore: avgScore,
      pressureLevel,
    };
  }

  // Rank sections by relevance to focus topic
  const ranked = rankChunksByBm25(sections, focusTopic);
  const maxScore = ranked.length > 0 ? Math.max(...ranked.map((r) => r.score)) : 0;
  const threshold = maxScore * 0.3; // Keep sections scoring above 30% of max

  // Compression floor: minimum output tokens
  const floorTokens = Math.floor(inputTokens * COMPRESSION_FLOOR);
  const effectiveMax = Math.max(maxTokens, floorTokens);

  // Build compressed output
  const outputParts: string[] = [];
  let tokensUsed = 0;
  let sectionsPreserved = 0;
  let sectionsCompressed = 0;

  // If all scores are 0, fall back to uniform compression of original text
  const allZeroScores = ranked.every((r) => r.score === 0);
  if (allZeroScores) {
    // Try structured compression first, fall back to simple truncation
    const compressed = compressText(text, "summary", effectiveMax);
    let result = compressed.compressed;
    let compressedTokens = estimateTokens(result);
    if (compressedTokens === 0) {
      // Truncate to fit budget by taking first N words
      const words = text.split(/\s+/);
      const truncated: string[] = [];
      let toks = 0;
      for (const w of words) {
        const wToks = estimateTokens(w + " ");
        if (toks + wToks > effectiveMax) break;
        truncated.push(w);
        toks += wToks;
      }
      result = truncated.join(" ");
      compressedTokens = estimateTokens(result);
    }
    return {
      compressed: result,
      stats: { inputTokens, outputTokens: compressedTokens, sectionsTotal: sections.length, sectionsPreserved: 0, sectionsCompressed: sections.length, reductionPercent: inputTokens > 0 ? Math.round((1 - compressedTokens / inputTokens) * 100) : 0 },
      focusRelevanceScore: 0,
      pressureLevel,
    };
  }

  for (const chunk of ranked) {
    if (tokensUsed >= effectiveMax) break;

    const remaining = effectiveMax - tokensUsed;

    if (chunk.score > threshold && chunk.tokens <= remaining) {
      // High relevance: preserve verbatim
      outputParts.push(chunk.content);
      tokensUsed += chunk.tokens;
      sectionsPreserved++;
    } else if (remaining > 10) {
      // Low relevance or too big: compress
      const compressed = compressText(chunk.content, "bullets", remaining);
      const compressedTokens = estimateTokens(compressed.compressed);
      if (compressedTokens > 0 && compressedTokens <= remaining) {
        outputParts.push(compressed.compressed);
        tokensUsed += compressedTokens;
        sectionsCompressed++;
      }
    }
  }

  const compressed = outputParts.join("\n\n");
  const outputTokens = estimateTokens(compressed);
  const avgScore = ranked.length > 0 ? ranked.reduce((s, r) => s + r.score, 0) / ranked.length : 0;

  logger.debug("focus-compressor", {
    focusTopic,
    inputTokens,
    outputTokens,
    sections: sections.length,
    preserved: sectionsPreserved,
    compressed: sectionsCompressed,
    pressure: pressureLevel,
  });

  return {
    compressed,
    stats: {
      inputTokens,
      outputTokens,
      sectionsTotal: sections.length,
      sectionsPreserved,
      sectionsCompressed,
      reductionPercent: Math.round((1 - outputTokens / inputTokens) * 100),
    },
    focusRelevanceScore: avgScore,
    pressureLevel,
  };
}
