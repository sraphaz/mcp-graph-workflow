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

import { describe, it, expect } from "vitest";
import { mapCitations, buildCitedContext } from "../core/rag/citation-mapper.js";
import type { RankedResult } from "../core/rag/multi-strategy-retrieval.js";

function makeResult(overrides: Partial<RankedResult> & { id: string }): RankedResult {
  return {
    sourceType: "docs",
    sourceId: "src-1",
    title: "Test Doc",
    content: "Content for testing citations.",
    score: 0.8,
    qualityScore: 0.7,
    strategies: ["fts"],
    ...overrides,
  };
}

describe("citation-mapper", () => {
  describe("mapCitations", () => {
    it("should create a citation for each result", () => {
      const results = [
        makeResult({ id: "a", title: "Doc A", sourceType: "prd" }),
        makeResult({ id: "b", title: "Doc B", sourceType: "docs" }),
      ];

      const citations = mapCitations(results);

      expect(citations).toHaveLength(2);
      expect(citations[0].chunkId).toBe("a");
      expect(citations[0].position).toBe(1);
      expect(citations[1].position).toBe(2);
    });

    it("should include snippet from content", () => {
      const results = [
        makeResult({ id: "a", content: "This is the relevant chunk content for citation." }),
      ];

      const citations = mapCitations(results);

      expect(citations[0].snippet.length).toBeGreaterThan(0);
      expect(citations[0].snippet.length).toBeLessThanOrEqual(400);
    });

    it("should return empty array for no results", () => {
      expect(mapCitations([])).toEqual([]);
    });
  });

  describe("buildCitedContext", () => {
    it("should assemble text with citation markers", () => {
      const results = [
        makeResult({ id: "a", title: "Auth Module", content: "JWT tokens are used.", sourceType: "code_context" }),
        makeResult({ id: "b", title: "PRD Section", content: "Users must authenticate.", sourceType: "prd" }),
      ];

      const cited = buildCitedContext(results);

      expect(cited.assembledText).toContain("[1]");
      expect(cited.assembledText).toContain("[2]");
      expect(cited.assembledText).toContain("JWT tokens");
      expect(cited.citations).toHaveLength(2);
    });

    it("should compute source breakdown correctly", () => {
      const results = [
        makeResult({ id: "a", sourceType: "prd" }),
        makeResult({ id: "b", sourceType: "prd" }),
        makeResult({ id: "c", sourceType: "docs" }),
      ];

      const cited = buildCitedContext(results);

      expect(cited.sourceBreakdown["prd"]).toBe(2);
      expect(cited.sourceBreakdown["docs"]).toBe(1);
    });

    it("should handle empty results", () => {
      const cited = buildCitedContext([]);

      expect(cited.assembledText).toBe("");
      expect(cited.citations).toEqual([]);
      expect(Object.keys(cited.sourceBreakdown)).toHaveLength(0);
    });
  });
});
