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
import {
  extractCitationRefs,
} from "../core/rag/citation-chain.js";

describe("CitationChain — RAG Provenance (Anti-Hallucination)", () => {
  it("should extract CitationRef[] from knowledge search results", () => {
    const knowledgeResults = [
      {
        id: "doc-1",
        title: "Architecture overview",
        content: "The system uses SQLite for storage...",
        sourceType: "memory",
        sourceId: "architecture-overview",
        score: 0.95,
      },
      {
        id: "doc-2",
        title: "ADR-001: In-Memory Map",
        content: "Decision to use in-memory map...",
        sourceType: "ai_decision",
        sourceId: "adr-001",
        score: 0.82,
      },
    ];

    const refs = extractCitationRefs(knowledgeResults);

    expect(refs).toHaveLength(2);
    expect(refs[0].docId).toBe("doc-1");
    expect(refs[0].sourceType).toBe("memory");
    expect(refs[0].confidence).toBe(0.95);
    expect(refs[0].chunkIndex).toBe(0);
    expect(refs[0].snippet).toContain("SQLite");
    expect(refs[1].docId).toBe("doc-2");
    expect(refs[1].chunkIndex).toBe(1);
  });

  it("should return empty array for empty results", () => {
    const refs = extractCitationRefs([]);
    expect(refs).toEqual([]);
    expect(Array.isArray(refs)).toBe(true);
  });

  it("should truncate long snippets to 200 chars", () => {
    const longContent = "A".repeat(500);
    const results = [
      {
        id: "doc-long",
        title: "Long doc",
        content: longContent,
        sourceType: "docs",
        sourceId: "long-doc",
        score: 0.7,
      },
    ];

    const refs = extractCitationRefs(results);

    expect(refs[0].snippet.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  it("should have all required CitationRef fields", () => {
    const results = [
      {
        id: "doc-x",
        title: "Test",
        content: "content here",
        sourceType: "prd",
        sourceId: "prd-1",
        score: 0.88,
      },
    ];

    const refs = extractCitationRefs(results);
    const ref = refs[0];

    expect(ref).toHaveProperty("docId");
    expect(ref).toHaveProperty("sourceType");
    expect(ref).toHaveProperty("snippet");
    expect(ref).toHaveProperty("confidence");
    expect(ref).toHaveProperty("chunkIndex");
    expect(typeof ref.docId).toBe("string");
    expect(typeof ref.sourceType).toBe("string");
    expect(typeof ref.snippet).toBe("string");
    expect(typeof ref.confidence).toBe("number");
    expect(typeof ref.chunkIndex).toBe("number");
  });

  it("should preserve score as confidence (0-1 range)", () => {
    const results = [
      {
        id: "doc-a",
        title: "A",
        content: "a",
        sourceType: "graph_node",
        sourceId: "node-1",
        score: 0.456,
      },
    ];

    const refs = extractCitationRefs(results);
    expect(refs[0].confidence).toBe(0.456);
  });
});
