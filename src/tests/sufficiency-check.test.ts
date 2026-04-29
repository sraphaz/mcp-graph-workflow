/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C4 — RAG sufficiency tests.
 */

import { describe, it, expect } from "vitest";
import {
  computeSufficiency,
  getSufficiencyThreshold,
  isAutoDocSyncEnabled,
  SUFFICIENCY_THRESHOLD,
  DEFAULT_TOP_K,
  type RagResult,
} from "../core/rag/sufficiency-check.js";

describe("sufficiency-check (E22.C4)", () => {
  it("SUFFICIENCY_THRESHOLD = 0.4", () => {
    expect(SUFFICIENCY_THRESHOLD).toBe(0.4);
  });

  it("DEFAULT_TOP_K = 5", () => {
    expect(DEFAULT_TOP_K).toBe(5);
  });

  it("returns score=0, sufficient=false on empty results", () => {
    const r = computeSufficiency([]);
    expect(r.score).toBe(0);
    expect(r.sufficient).toBe(false);
    expect(r.topK).toBe(0);
  });

  it("avg relevance over top-K only", () => {
    const results: RagResult[] = [
      { source: "a", relevance: 0.9 },
      { source: "b", relevance: 0.7 },
      { source: "c", relevance: 0.5 },
      { source: "d", relevance: 0.1 },
    ];
    const r = computeSufficiency(results, { topK: 3 });
    expect(r.topK).toBe(3);
    expect(r.score).toBeCloseTo(0.7);
    expect(r.sufficient).toBe(true);
  });

  it("sufficient=true when score >= threshold", () => {
    const r = computeSufficiency([
      { source: "a", relevance: 0.5 },
      { source: "b", relevance: 0.4 },
    ]);
    expect(r.score).toBeCloseTo(0.45);
    expect(r.sufficient).toBe(true);
  });

  it("sufficient=false when score < threshold (0.3 < 0.4)", () => {
    const r = computeSufficiency([
      { source: "a", relevance: 0.3 },
      { source: "b", relevance: 0.3 },
    ]);
    expect(r.sufficient).toBe(false);
  });

  it("custom threshold honored", () => {
    const r = computeSufficiency([{ source: "a", relevance: 0.6 }], { threshold: 0.7 });
    expect(r.sufficient).toBe(false);
  });

  it("expectedTerms produces gap for unmatched terms", () => {
    const results: RagResult[] = [
      { source: "doc1", relevance: 0.5, text: "OAuth flow with PKCE" },
    ];
    const r = computeSufficiency(results, { expectedTerms: ["OAuth", "JWT", "PKCE"] });
    expect(r.gap).toEqual(["JWT"]);
  });

  it("gap is empty when all expected terms found (case insensitive)", () => {
    const results: RagResult[] = [
      { source: "doc1", relevance: 0.5, text: "OAUTH flow with pkce" },
    ];
    const r = computeSufficiency(results, { expectedTerms: ["oauth", "PKCE"] });
    expect(r.gap).toEqual([]);
  });

  it("getSufficiencyThreshold respects env override", () => {
    expect(getSufficiencyThreshold({ SUFFICIENCY_THRESHOLD: "0.6" })).toBe(0.6);
    expect(getSufficiencyThreshold({ MCP_GRAPH_SUFFICIENCY_THRESHOLD: "0.55" })).toBe(0.55);
    expect(getSufficiencyThreshold({})).toBe(0.4);
    expect(getSufficiencyThreshold({ SUFFICIENCY_THRESHOLD: "1.5" })).toBe(0.4); // out of range
    expect(getSufficiencyThreshold({ SUFFICIENCY_THRESHOLD: "abc" })).toBe(0.4);
  });

  it("isAutoDocSyncEnabled true only when env=true", () => {
    expect(isAutoDocSyncEnabled({ MCP_GRAPH_AUTO_DOC_SYNC: "true" })).toBe(true);
    expect(isAutoDocSyncEnabled({})).toBe(false);
    expect(isAutoDocSyncEnabled({ MCP_GRAPH_AUTO_DOC_SYNC: "1" })).toBe(false);
  });
});
