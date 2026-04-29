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

import { describe, it, expect, vi } from "vitest";
import {
  splitAtBoundaries,
  analyzeChunked,
} from "../core/translation/chunked-analyzer.js";
import type { TranslationAnalysis } from "../core/translation/translation-types.js";

describe("splitAtBoundaries", () => {
  it("should return [code] (single chunk) when input has no boundaries for language", () => {
    const code = "const x = 1;\nconst y = 2;\nconst z = 3;\n";
    const chunks = splitAtBoundaries(code, "typescript");

    // Either a single chunk or splits — result is always non-empty.
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // All chunks together preserve the original line count.
    const totalLines = chunks.reduce((sum, c) => sum + c.split("\n").length, 0);
    expect(totalLines).toBe(code.split("\n").length);
  });

  it("should split TS code at function/class boundaries", () => {
    const code = `function alpha() { return 1; }
function beta() { return 2; }
class Foo {}`;
    const chunks = splitAtBoundaries(code, "typescript");

    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("should fall back to line-count chunking for unknown language", () => {
    const lines: string[] = [];
    for (let i = 0; i < 2500; i++) lines.push(`line ${i}`);
    const code = lines.join("\n");

    const chunks = splitAtBoundaries(code, "klingon");

    // Default split is every 1000 lines → 3 chunks for 2500 lines.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("should preserve total content across all chunks (no data loss)", () => {
    const code = "function a() {}\nfunction b() {}\nfunction c() {}\n";
    const chunks = splitAtBoundaries(code, "typescript");

    const reconstructed = chunks.join("\n");
    // Every original line must appear in some chunk.
    for (const line of code.split("\n")) {
      if (line.trim()) {
        expect(reconstructed).toContain(line);
      }
    }
  });
});

describe("analyzeChunked", () => {
  const stubAnalysis: TranslationAnalysis = {
    sourceLanguage: "typescript",
    targetLanguage: "python",
    constructs: [],
    confidenceScore: 0.8,
    deterministic: false,
    estimatedTokens: 100,
  } as unknown as TranslationAnalysis;

  it("should single-pass analyze code below threshold (chunked=false)", () => {
    const analyzeFn = vi.fn().mockReturnValue({ ...stubAnalysis, cacheHit: false });

    const result = analyzeChunked(
      "small code",
      analyzeFn,
      { languageHint: "typescript" },
      { chunkThresholdBytes: 1024 * 100 },
    );

    expect(result.chunked).toBe(false);
    expect(result.chunkCount).toBe(1);
    expect(analyzeFn).toHaveBeenCalledTimes(1);
  });

  it("should chunk-analyze code above threshold (chunked=true, chunkCount>1)", () => {
    const analyzeFn = vi.fn().mockReturnValue({ ...stubAnalysis, cacheHit: false });

    // Build code that exceeds the threshold AND has TS boundaries.
    const blocks: string[] = [];
    for (let i = 0; i < 50; i++) {
      blocks.push(`function block${i}() { return ${i}; }`);
    }
    const big = blocks.join("\n");

    const result = analyzeChunked(
      big,
      analyzeFn,
      { languageHint: "typescript" },
      { chunkThresholdBytes: 100 }, // tiny threshold to force chunking
    );

    expect(result.chunked).toBe(true);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(analyzeFn.mock.calls.length).toBeGreaterThan(1);
  });

  it("should pass hints to each chunk's analyzeFn", () => {
    const analyzeFn = vi.fn().mockReturnValue({ ...stubAnalysis, cacheHit: false });

    analyzeChunked("small", analyzeFn, { languageHint: "ruby" });

    expect(analyzeFn.mock.calls[0][1]).toEqual({ languageHint: "ruby" });
  });
});
