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
 * Tests for aggregate confidence calculation in post-retrieval pipeline.
 *
 * node_ae6812a1629f — "Calculo de confianca agregada no pos-retrieval"
 * Parent: Inclui — wave-03 scope items (loop reflexivo de retrieval)
 *
 * PostRetrievalResult must include a BatchConfidenceSignal so callers
 * can decide whether to trigger a retry pass.
 */

import { describe, it, expect } from "vitest";
import { postRetrievalPipeline } from "../../core/rag/post-retrieval.js";
import type { RankedResult } from "../../core/rag/multi-strategy-retrieval.js";
import type { BatchConfidenceSignal } from "../../core/rag/corrective-rag.js";

function makeResult(id: string, score: number): RankedResult {
  return {
    id,
    sourceType: "prd",
    sourceId: "src_1",
    title: `Doc ${id}`,
    content: `Content for ${id} with unique text`,
    score,
    qualityScore: score,
    strategies: ["fts"],
  };
}

describe("postRetrievalPipeline — confidence signal", () => {
  it("should include confidenceSignal in PostRetrievalResult", () => {
    const results = [makeResult("a", 0.9), makeResult("b", 0.7)];
    const output = postRetrievalPipeline({ query: "test query", results, maxResults: 10 });
    expect(output.confidenceSignal).toBeDefined();
    const sig = output.confidenceSignal as BatchConfidenceSignal;
    expect(typeof sig.mean).toBe("number");
    expect(typeof sig.min).toBe("number");
    expect(typeof sig.composite).toBe("number");
    expect(typeof sig.count).toBe("number");
  });

  it("should return count matching deduplicated results", () => {
    const results = [makeResult("a", 0.8), makeResult("b", 0.6)];
    const output = postRetrievalPipeline({ query: "test", results, maxResults: 10 });
    expect(output.confidenceSignal.count).toBe(output.results.length);
  });

  it("should return zero-confidence signal for empty results", () => {
    const output = postRetrievalPipeline({ query: "test", results: [], maxResults: 10 });
    expect(output.confidenceSignal.mean).toBe(0);
    expect(output.confidenceSignal.composite).toBe(0);
    expect(output.confidenceSignal.count).toBe(0);
  });

  it("higher-scored results should produce higher confidence signal", () => {
    const lowResults = [makeResult("a", 0.1), makeResult("b", 0.2)];
    const highResults = [makeResult("c", 0.9), makeResult("d", 0.8)];

    const low = postRetrievalPipeline({ query: "test", results: lowResults, maxResults: 10 });
    const high = postRetrievalPipeline({ query: "test", results: highResults, maxResults: 10 });

    expect(high.confidenceSignal.mean).toBeGreaterThan(low.confidenceSignal.mean);
  });
});
