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
 * Decision Provenance Tests
 *
 * Tests creation, query, and chain retrieval of decision provenance records,
 * linking agent decisions to the RAG citations that informed them.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import {
  createProvenance,
  queryProvenance,
  getProvenanceChain,
} from "../core/rag/decision-provenance.js";
import type { CitationRef } from "../core/rag/citation-chain.js";

describe("decision-provenance", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Provenance Test");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  function makeCitation(overrides: Partial<CitationRef> = {}): CitationRef {
    return {
      docId: "kdoc-123",
      sourceType: "memory",
      snippet: "Some relevant context from memory",
      confidence: 0.85,
      chunkIndex: 0,
      ...overrides,
    };
  }

  describe("createProvenance", () => {
    it("should store a decision with citations and return an id", () => {
      const citations: CitationRef[] = [
        makeCitation({ docId: "kdoc-1", confidence: 0.9 }),
        makeCitation({ docId: "kdoc-2", confidence: 0.7 }),
        makeCitation({ docId: "kdoc-3", confidence: 0.6 }),
      ];

      const id = createProvenance(knowledgeStore, {
        nodeId: "node-42",
        rationale: "Chose approach X because of citation evidence",
        citations,
        timestamp: new Date().toISOString(),
      });

      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });

    it("should store a decision without citations (backward compatible)", () => {
      const id = createProvenance(knowledgeStore, {
        nodeId: "node-99",
        rationale: "Simple decision with no RAG context",
        citations: [],
        timestamp: new Date().toISOString(),
      });

      expect(id).toBeTruthy();
    });
  });

  describe("queryProvenance", () => {
    it("should retrieve provenance records for a node", () => {
      const citations: CitationRef[] = [
        makeCitation({ docId: "kdoc-1", confidence: 0.9 }),
        makeCitation({ docId: "kdoc-2", confidence: 0.7 }),
        makeCitation({ docId: "kdoc-3", confidence: 0.6 }),
      ];

      createProvenance(knowledgeStore, {
        nodeId: "node-42",
        rationale: "Decision with 3 citations",
        citations,
        timestamp: new Date().toISOString(),
      });

      const results = queryProvenance(knowledgeStore, "node-42");

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe("node-42");
      expect(results[0].rationale).toBe("Decision with 3 citations");
      expect(results[0].citations).toHaveLength(3);
      expect(results[0].citations[0].docId).toBe("kdoc-1");
    });

    it("should return empty array for node with no provenance", () => {
      const results = queryProvenance(knowledgeStore, "nonexistent-node");

      expect(results).toEqual([]);
    });
  });

  describe("getProvenanceChain", () => {
    it("should return multiple decisions for a node in chronological order", () => {
      const ts1 = "2026-04-14T10:00:00.000Z";
      const ts2 = "2026-04-14T11:00:00.000Z";

      createProvenance(knowledgeStore, {
        nodeId: "node-42",
        rationale: "First decision",
        citations: [makeCitation({ docId: "kdoc-1" })],
        timestamp: ts1,
      });

      createProvenance(knowledgeStore, {
        nodeId: "node-42",
        rationale: "Second decision",
        citations: [makeCitation({ docId: "kdoc-2" })],
        timestamp: ts2,
      });

      const chain = getProvenanceChain(knowledgeStore, "node-42");

      expect(chain).toHaveLength(2);
      expect(chain[0].rationale).toBe("First decision");
      expect(chain[1].rationale).toBe("Second decision");
    });

    it("should not include provenance from other nodes", () => {
      createProvenance(knowledgeStore, {
        nodeId: "node-A",
        rationale: "Decision for A",
        citations: [],
        timestamp: new Date().toISOString(),
      });

      createProvenance(knowledgeStore, {
        nodeId: "node-B",
        rationale: "Decision for B",
        citations: [],
        timestamp: new Date().toISOString(),
      });

      const chainA = getProvenanceChain(knowledgeStore, "node-A");
      const chainB = getProvenanceChain(knowledgeStore, "node-B");

      expect(chainA).toHaveLength(1);
      expect(chainA[0].rationale).toBe("Decision for A");
      expect(chainB).toHaveLength(1);
      expect(chainB[0].rationale).toBe("Decision for B");
    });
  });

  describe("ragTraceId linking", () => {
    it("should store and retrieve ragTraceId when provided", () => {
      createProvenance(knowledgeStore, {
        nodeId: "node-traced",
        rationale: "Decision with trace",
        citations: [makeCitation()],
        ragTraceId: "trace-abc-123",
        timestamp: new Date().toISOString(),
      });

      const results = queryProvenance(knowledgeStore, "node-traced");

      expect(results).toHaveLength(1);
      expect(results[0].ragTraceId).toBe("trace-abc-123");
    });
  });
});
