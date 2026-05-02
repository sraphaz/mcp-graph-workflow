/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * Embedding cosine-similarity scorer (depends on EPIC 17 ONNX embeddings).
 *
 * Cosine similarity is clamped to [0,1] for the score (negatives → 0). This
 * matches the "no signal vs aligned" framing rather than "opposed" — useful
 * when the LLM output is unrelated to expected, not contradictory.
 */

import type { EmbeddingProvider } from "../../rag/onnx-embeddings.js";
import type { AsyncScorer, ScorerResult } from "./types.js";

export interface EmbeddingCosineInput {
  output: string;
  expected: string;
  provider: EmbeddingProvider;
  /** Threshold on 0..1 cosine similarity. Default 0.8. */
  threshold?: number;
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const nVar = Math.min(a.length, b.length);
  for (let i = 0; i < nVar; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined || bi === undefined) break;
    sum += ai * bi;
  }
  return sum;
}

function l2(v: number[]): number {
  let sum = 0;
  for (const xVar of v) sum += xVar * xVar;
  return Math.sqrt(sum);
}

function cosine(a: number[], b: number[]): number {
  const denom = l2(a) * l2(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
}

export const embeddingCosineScorer: AsyncScorer<EmbeddingCosineInput> = {
  kind: "embedding-cosine",
  async score(input: EmbeddingCosineInput): Promise<ScorerResult> {
    const [a, b] = await input.provider.generateBatch([input.output, input.expected]);
    if (!a || !b) {
      return { score: 0, passed: false, details: "provider returned empty embeddings" };
    }
    const sim = cosine(a, b);
    const score = Math.max(0, Math.min(1, sim));
    const threshold = input.threshold ?? 0.8;
    return {
      score,
      passed: score >= threshold,
      details: `cosine=${sim.toFixed(4)}`,
    };
  },
};
