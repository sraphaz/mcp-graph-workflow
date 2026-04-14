/**
 * Text compression dispatcher — routes to the appropriate rule-based compressor.
 */

import { compressBullets, compressSummary, compressSteps, compressJson } from "./rule-compressor.js";
import { estimateTokens } from "./token-estimator.js";
import { logger } from "../utils/logger.js";

export type CompressFormat = "bullets" | "summary" | "steps" | "json";

export interface CompressStats {
  input_tokens: number;
  output_tokens: number;
  reduction_percent: number;
  format: CompressFormat;
}

export interface CompressResult {
  compressed: string;
  stats: CompressStats;
}

/**
 * Compress text using the specified format.
 * Returns compressed text and compression statistics.
 */
export function compressText(
  text: string,
  format: CompressFormat,
  maxTokens: number,
): CompressResult {
  const inputTokens = estimateTokens(text);

  if (!text.trim()) {
    return {
      compressed: "",
      stats: {
        input_tokens: 0,
        output_tokens: 0,
        reduction_percent: 0,
        format,
      },
    };
  }

  let compressed: string;

  switch (format) {
    case "bullets":
      compressed = compressBullets(text, maxTokens);
      break;
    case "summary":
      compressed = compressSummary(text, maxTokens);
      break;
    case "steps":
      compressed = compressSteps(text, maxTokens);
      break;
    case "json":
      compressed = compressJson(text, maxTokens);
      break;
    default:
      logger.warn("compress-text:unknown-format", { format });
      compressed = text;
      break;
  }

  const outputTokens = estimateTokens(compressed);
  const reductionPercent = inputTokens > 0
    ? Math.round((1 - outputTokens / inputTokens) * 100)
    : 0;

  return {
    compressed,
    stats: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      reduction_percent: reductionPercent,
      format,
    },
  };
}
