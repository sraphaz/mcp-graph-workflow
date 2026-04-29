/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T06 — memory dedup tests.
 */

import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  findNearDuplicates,
  shouldSkipDedup,
  getDedupWindow,
  isMemoryDedupDisabled,
  DEDUP_SIMILARITY_THRESHOLD,
  DEFAULT_DEDUP_WINDOW,
  MIN_DEDUP_CONTENT_LEN,
} from "../core/hooks/memory-dedup-detector.js";

describe("memory-dedup-detector (E21.T06)", () => {
  it("constants: threshold=0.85, window=100, minContentLen=50", () => {
    expect(DEDUP_SIMILARITY_THRESHOLD).toBe(0.85);
    expect(DEFAULT_DEDUP_WINDOW).toBe(100);
    expect(MIN_DEDUP_CONTENT_LEN).toBe(50);
  });

  it("cosineSimilarity: identical vectors → 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
  });

  it("cosineSimilarity: orthogonal → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("cosineSimilarity: empty or mismatched lengths → 0", () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("cosineSimilarity: zero vector → 0 (no division by zero)", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("findNearDuplicates: returns matches above threshold", () => {
    const matches = findNearDuplicates(
      { id: "new", vector: [1, 0, 0] },
      [
        { id: "a", vector: [1, 0, 0] },           // sim=1
        { id: "b", vector: [0.95, 0.1, 0.1] },    // sim ~ 0.97
        { id: "c", vector: [0, 1, 0] },           // sim=0
      ],
    );
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.existingId)).toEqual(["a", "b"]);
  });

  it("findNearDuplicates: orders by similarity DESC", () => {
    const matches = findNearDuplicates(
      { id: "n", vector: [1, 0] },
      [
        { id: "lower", vector: [0.9, 0.1] },
        { id: "higher", vector: [0.99, 0.01] },
      ],
      0.5,
    );
    expect(matches[0].existingId).toBe("higher");
    expect(matches[0].similarity).toBeGreaterThan(matches[1].similarity);
  });

  it("findNearDuplicates: excludes self by id", () => {
    const matches = findNearDuplicates(
      { id: "self", vector: [1, 0] },
      [
        { id: "self", vector: [1, 0] }, // would be 1.0 but excluded
        { id: "other", vector: [0.9, 0.1] },
      ],
    );
    expect(matches.find((m) => m.existingId === "self")).toBeUndefined();
  });

  it("shouldSkipDedup: true for empty or short content (<50 chars)", () => {
    expect(shouldSkipDedup("")).toBe(true);
    expect(shouldSkipDedup("short note")).toBe(true);
    expect(shouldSkipDedup("x".repeat(50))).toBe(false);
  });

  it("getDedupWindow: env override", () => {
    expect(getDedupWindow({ MCP_GRAPH_DEDUP_WINDOW: "50" })).toBe(50);
    expect(getDedupWindow({})).toBe(100);
    expect(getDedupWindow({ MCP_GRAPH_DEDUP_WINDOW: "bad" })).toBe(100);
  });

  it("isMemoryDedupDisabled respects MCP_GRAPH_MEMORY_DEDUP=off", () => {
    expect(isMemoryDedupDisabled({ MCP_GRAPH_MEMORY_DEDUP: "off" })).toBe(true);
    expect(isMemoryDedupDisabled({})).toBe(false);
  });
});
