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
 * Tests for query-expander.ts — PRF (Pseudo-Relevance Feedback) query expansion.
 *
 * Task 4.1 (node_e5539399904b) — Epic: PRF Query Expansion
 *
 * AC1: 1-token query → expanded with >= 2 additional terms from top-3 docs
 * AC2: 5+ token query → no original terms removed, only additions
 * AC3: 0 results from retriever → returns original query unchanged
 * AC5: queryExpansion: false → PRF not applied (feature flag)
 */

import { describe, it, expect } from "vitest";
import {
  expandQuery,
  type QueryExpansionConfig,
  type DocRetriever,
} from "../core/rag/query-expander.js";

// Mock retriever that returns pre-defined docs
function makeRetriever(docs: Array<{ title: string; content: string }>): DocRetriever {
  return (_query: string, _limit: number) => docs;
}

const PRD_DOCS = [
  {
    title: "PRD: Dashboard Performance",
    content: "The PRD defines requirements for dashboard pagination, filtering, and lazy loading of graph nodes.",
  },
  {
    title: "PRD: Knowledge Pipeline",
    content: "PRD covers the knowledge indexing pipeline with RAG retrieval, chunking, and embedding strategies.",
  },
  {
    title: "PRD: Sprint Planning",
    content: "PRD outlines sprint planning features including velocity tracking, burndown charts, and backlog prioritization.",
  },
];

describe("query-expander (PRF)", () => {
  // ── AC1: Short query (1 token) gets expanded ──
  describe("AC1: short query expansion", () => {
    it("should add >= 2 terms to a 1-token query from top-3 docs", () => {
      const retriever = makeRetriever(PRD_DOCS);

      const result = expandQuery("PRD", retriever);

      // Original term should be preserved
      expect(result.expandedQuery.toLowerCase()).toContain("prd");

      // Should have added terms from the docs
      expect(result.addedTerms.length).toBeGreaterThanOrEqual(2);

      // Expanded query should be longer than original
      expect(result.expandedQuery.split(/\s+/).length).toBeGreaterThan(1);
    });

    it("should extract discriminative terms from retrieved docs", () => {
      const retriever = makeRetriever([
        { title: "Auth Flow", content: "JWT authentication with OAuth2 token refresh and session management" },
        { title: "Auth Middleware", content: "Express middleware for JWT validation and OAuth2 integration" },
        { title: "Auth Testing", content: "Unit tests for authentication middleware with JWT mocking" },
      ]);

      const result = expandQuery("auth", retriever);

      // Terms like "jwt", "oauth2", "middleware" should appear as expansion terms
      const addedLower = result.addedTerms.map((t) => t.toLowerCase());
      const hasRelevant = addedLower.some((t) =>
        ["jwt", "oauth2", "middleware", "authentication", "token"].includes(t),
      );
      expect(hasRelevant).toBe(true);
    });
  });

  // ── AC2: Multi-token query preserves all original terms ──
  describe("AC2: multi-token query preservation", () => {
    it("should preserve all original terms in a 5+ token query", () => {
      const retriever = makeRetriever(PRD_DOCS);
      const originalQuery = "dashboard pagination filtering lazy loading";
      const originalTerms = originalQuery.toLowerCase().split(/\s+/);

      const result = expandQuery(originalQuery, retriever);

      const expandedLower = result.expandedQuery.toLowerCase();
      for (const term of originalTerms) {
        expect(expandedLower).toContain(term);
      }
    });

    it("should only add new terms, not duplicate originals", () => {
      const retriever = makeRetriever(PRD_DOCS);

      const result = expandQuery("sprint planning velocity backlog charts", retriever);

      // Added terms should not include original query terms
      const originalSet = new Set(["sprint", "planning", "velocity", "backlog", "charts"]);
      for (const added of result.addedTerms) {
        expect(originalSet.has(added.toLowerCase())).toBe(false);
      }
    });
  });

  // ── AC3: 0 results → graceful degradation ──
  describe("AC3: empty retrieval graceful degradation", () => {
    it("should return original query when retriever returns 0 docs", () => {
      const emptyRetriever = makeRetriever([]);

      const result = expandQuery("xyznonexistent", emptyRetriever);

      expect(result.expandedQuery).toBe("xyznonexistent");
      expect(result.addedTerms).toHaveLength(0);
      expect(result.expanded).toBe(false);
    });

    it("should return original query when retriever throws", () => {
      const failingRetriever: DocRetriever = () => {
        throw new Error("FTS5 failure");
      };

      const result = expandQuery("some query", failingRetriever);

      expect(result.expandedQuery).toBe("some query");
      expect(result.expanded).toBe(false);
    });
  });

  // ── AC5: Feature flag ──
  describe("AC5: feature flag queryExpansion", () => {
    it("should skip expansion when queryExpansion is false", () => {
      const retriever = makeRetriever(PRD_DOCS);
      const config: QueryExpansionConfig = { enabled: false };

      const result = expandQuery("PRD", retriever, config);

      expect(result.expandedQuery).toBe("PRD");
      expect(result.addedTerms).toHaveLength(0);
      expect(result.expanded).toBe(false);
    });

    it("should expand when queryExpansion is true (default)", () => {
      const retriever = makeRetriever(PRD_DOCS);

      const result = expandQuery("PRD", retriever);

      expect(result.expanded).toBe(true);
      expect(result.addedTerms.length).toBeGreaterThan(0);
    });
  });

  // ── Config options ──
  describe("config options", () => {
    it("should respect topK parameter", () => {
      const retriever = makeRetriever(PRD_DOCS);
      const config: QueryExpansionConfig = { topK: 2 };

      const result = expandQuery("PRD", retriever, config);

      // Should still work with fewer docs
      expect(result.addedTerms.length).toBeGreaterThanOrEqual(1);
    });

    it("should respect maxTerms parameter", () => {
      const retriever = makeRetriever(PRD_DOCS);
      const config: QueryExpansionConfig = { maxTerms: 2 };

      const result = expandQuery("PRD", retriever, config);

      expect(result.addedTerms.length).toBeLessThanOrEqual(2);
    });
  });
});
