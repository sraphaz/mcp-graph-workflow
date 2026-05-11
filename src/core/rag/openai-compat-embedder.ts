/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-embeddings — Task 2.2: OpenAI-compatible adapter for embedding-store.
 *
 * Bridges OpenAICompatibleAdapter.embed() to the number[] vectors that
 * EmbeddingStore.upsert() expects. Zero changes to embedding-store core.
 */

import type { OpenAICompatibleAdapter } from "../llm/adapters/openai-compatible.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "rag/openai-compat-embedder.ts" });

export interface EmbedBatchResult {
  text: string;
  vector: number[];
}

export class OpenAICompatibleEmbedder {
  private readonly adapter: OpenAICompatibleAdapter;
  private readonly modelId: string;

  constructor(adapter: OpenAICompatibleAdapter, modelId: string) {
    this.adapter = adapter;
    this.modelId = modelId;
  }

  async embedBatch(texts: string[]): Promise<EmbedBatchResult[]> {
    const response = await this.adapter.embed({ model: this.modelId, input: texts });
    const vectors = response.vectors;

    this.checkDimensions(vectors);

    return texts.map((text, i) => ({ text, vector: vectors[i]! }));
  }

  private checkDimensions(vectors: number[][]): void {
    if (vectors.length < 2) return;
    const expectedDim = vectors[0]!.length;
    const mismatch = vectors.find((v) => v.length !== expectedDim);
    if (mismatch) {
      this.onDimensionMismatch(expectedDim, mismatch.length);
    }
  }

  onDimensionMismatch(expected: number, got: number): void {
    log.warn("embedder.dimension-mismatch", {
      expected,
      got,
      model: this.modelId,
      providerId: this.adapter.providerId,
      hint: "likely a model bug — vectors have inconsistent dimensions",
    });
  }
}
