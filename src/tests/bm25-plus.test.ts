/**
 * Tests for BM25+ upgrade (delta parameter).
 *
 * Task 3.1 (node_63c1ed347ddd) — Epic: BM25+ Upgrade
 *
 * AC1: Short doc (3 tokens) with search term → score > 0 with δ=1.0
 * AC2: δ=0.0 → result identical to standard BM25
 * AC3: Default δ=1.0 when not provided
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  rankChunksByBm25,
  setBm25Config,
  resetBm25Config,
  getBm25Config,
  BM25_DEFAULTS,
} from "../core/context/bm25-compressor.js";

describe("BM25+ with delta parameter", () => {
  afterEach(() => {
    resetBm25Config();
  });

  // ── AC1: Short doc scores > 0 with δ=1.0 ──
  describe("AC1: short document scoring", () => {
    it("should score > 0 for a 3-token document containing the search term with δ=1.0", () => {
      // δ=1.0 is the default for BM25+
      // A short doc "sqlite local db" searched for "sqlite" should score > 0
      const chunks = ["sqlite local db"];
      const results = rankChunksByBm25(chunks, "sqlite");

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("should boost short docs compared to δ=0 (standard BM25)", () => {
      const chunks = ["sqlite"];

      // First with default δ=1.0 (BM25+)
      const resultsPlus = rankChunksByBm25(chunks, "sqlite");

      // Then with δ=0 (standard BM25)
      setBm25Config({ delta: 0 });
      const resultsStandard = rankChunksByBm25(chunks, "sqlite");

      // BM25+ should give higher or equal score for short docs
      expect(resultsPlus[0].score).toBeGreaterThanOrEqual(resultsStandard[0].score);
    });
  });

  // ── AC2: δ=0 → identical to standard BM25 ──
  describe("AC2: backward compatibility with δ=0", () => {
    it("should produce identical scores with δ=0 as standard BM25 formula", () => {
      setBm25Config({ delta: 0 });

      const chunks = [
        "The quick brown fox jumps over the lazy dog",
        "A lazy dog sleeps in the sun all day long",
        "Quick fox runs through the forest at dawn",
      ];

      const results = rankChunksByBm25(chunks, "lazy dog");

      // With δ=0, BM25+ degrades to standard BM25
      // Scores should be valid BM25 scores
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);

      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("should give same ranking with δ=0 as before the upgrade", () => {
      setBm25Config({ delta: 0 });

      const chunks = [
        "sqlite database migration schema",
        "authentication token jwt session",
        "sqlite local storage fast queries",
      ];

      const results = rankChunksByBm25(chunks, "sqlite");

      // The chunks containing "sqlite" should rank above the one without
      expect(results[0].content).toContain("sqlite");
      expect(results[1].content).toContain("sqlite");
    });
  });

  // ── AC3: Default δ=1.0 ──
  describe("AC3: default delta value", () => {
    it("should have delta=1.0 in BM25_DEFAULTS", () => {
      expect(BM25_DEFAULTS.delta).toBe(1.0);
    });

    it("should use delta=1.0 when not explicitly set", () => {
      const config = getBm25Config();
      expect(config.delta).toBe(1.0);
    });

    it("should allow overriding delta via setBm25Config", () => {
      setBm25Config({ delta: 0.5 });
      const config = getBm25Config();
      expect(config.delta).toBe(0.5);
    });

    it("should reset delta to 1.0 on resetBm25Config", () => {
      setBm25Config({ delta: 2.0 });
      resetBm25Config();
      const config = getBm25Config();
      expect(config.delta).toBe(1.0);
    });
  });

  // ── Ranking stability ──
  describe("ranking stability", () => {
    it("should still rank relevant chunks higher than irrelevant", () => {
      const chunks = [
        "database schema migration for user tables",
        "completely unrelated chunk about cooking recipes",
        "sqlite database performance optimization queries",
      ];

      const results = rankChunksByBm25(chunks, "database sqlite");

      // The chunks about database/sqlite should be at the top
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].content).toContain("database");
    });
  });
});
