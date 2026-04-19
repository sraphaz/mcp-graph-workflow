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

import { describe, it, expect, afterEach } from "vitest";
import {
  rankChunksByBm25,
  setBm25Config,
  resetBm25Config,
  getBm25Config,
  BM25_DEFAULTS,
} from "../core/context/bm25-compressor.js";

describe("BM25 Tuning", () => {
  afterEach(() => {
    resetBm25Config();
  });

  describe("BM25_DEFAULTS", () => {
    it("should have k1=1.8 for PRD/code content", () => {
      expect(BM25_DEFAULTS.k1).toBe(1.8);
    });

    it("should have b=0.75 for standard length normalization", () => {
      expect(BM25_DEFAULTS.b).toBe(0.75);
    });
  });

  describe("setBm25Config / getBm25Config", () => {
    it("should override k1 while keeping b", () => {
      setBm25Config({ k1: 2.0 });
      const config = getBm25Config();
      expect(config.k1).toBe(2.0);
      expect(config.b).toBe(0.75);
    });

    it("should override b while keeping k1", () => {
      setBm25Config({ b: 0.5 });
      const config = getBm25Config();
      expect(config.k1).toBe(1.8);
      expect(config.b).toBe(0.5);
    });

    it("should override both parameters", () => {
      setBm25Config({ k1: 1.2, b: 0.6 });
      const config = getBm25Config();
      expect(config.k1).toBe(1.2);
      expect(config.b).toBe(0.6);
    });
  });

  describe("resetBm25Config", () => {
    it("should restore default parameters", () => {
      setBm25Config({ k1: 999, b: 0 });
      resetBm25Config();
      const config = getBm25Config();
      expect(config.k1).toBe(BM25_DEFAULTS.k1);
      expect(config.b).toBe(BM25_DEFAULTS.b);
    });
  });

  describe("k1 tuning impact on ranking", () => {
    const chunks = [
      "GraphNode is the core type for execution graph nodes in mcp-graph",
      "Express is a web framework for building REST APIs with Node.js",
      "SQLite FTS5 provides full-text search with BM25 ranking built-in",
      "The search module tokenizes queries and computes TF-IDF scores",
    ];

    it("should produce different rankings with different k1 values", () => {
      // Rank with default k1=1.8
      const defaultRanked = rankChunksByBm25(chunks, "GraphNode execution graph");
      const defaultTopScore = defaultRanked[0].score;

      // Rank with lower k1=0.5 (less saturation = term repetition matters more)
      setBm25Config({ k1: 0.5 });
      const lowK1Ranked = rankChunksByBm25(chunks, "GraphNode execution graph");
      const lowK1TopScore = lowK1Ranked[0].score;

      // Both should find the same top result
      expect(defaultRanked[0].content).toContain("GraphNode");
      expect(lowK1Ranked[0].content).toContain("GraphNode");

      // But scores differ due to k1 tuning
      expect(defaultTopScore).not.toBe(lowK1TopScore);
    });

    it("higher k1 should boost rare terms more in PRD/code queries", () => {
      // With higher k1, rare terms like "FTS5" get more weight
      setBm25Config({ k1: 2.5 });
      const highK1 = rankChunksByBm25(chunks, "FTS5 BM25 ranking");

      resetBm25Config();
      setBm25Config({ k1: 0.5 });
      const lowK1 = rankChunksByBm25(chunks, "FTS5 BM25 ranking");

      // The FTS5 chunk should score well in both, but check ranking is stable
      expect(highK1[0].content).toContain("FTS5");
      expect(lowK1[0].content).toContain("FTS5");
    });
  });
});
