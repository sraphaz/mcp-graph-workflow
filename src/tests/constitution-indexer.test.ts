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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { KnowledgeSourceTypeSchema } from "../schemas/knowledge.schema.js";
import { indexConstitution } from "../core/rag/constitution-indexer.js";
import { PHASE_SOURCE_AFFINITY } from "../core/rag/phase-metadata.js";

describe("Constitution knowledge indexer", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  describe("KnowledgeSourceTypeSchema", () => {
    it("should accept 'constitution' as a valid source type", () => {
      const result = KnowledgeSourceTypeSchema.safeParse("constitution");
      expect(result.success).toBe(true);
    });
  });

  describe("Phase source affinity", () => {
    it("should boost constitution in DESIGN phase (>= 1.5)", () => {
      expect(PHASE_SOURCE_AFFINITY.DESIGN.constitution).toBeGreaterThanOrEqual(1.5);
    });

    it("should boost constitution in REVIEW phase (>= 1.3)", () => {
      expect(PHASE_SOURCE_AFFINITY.REVIEW.constitution).toBeGreaterThanOrEqual(1.3);
    });

    it("should boost constitution in VALIDATE phase (>= 1.3)", () => {
      expect(PHASE_SOURCE_AFFINITY.VALIDATE.constitution).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe("indexConstitution", () => {
    it("should index each principle as a separate knowledge document", () => {
      // Arrange
      const principles = [
        { id: "p1", title: "Library-first", description: "Prefer libraries", category: "architecture", weight: 0.8, enforceable: true },
        { id: "p2", title: "TDD mandatory", description: "Test before code", category: "process", weight: 1.0, enforceable: true },
        { id: "p3", title: "No external infra", description: "SQLite only", category: "constraint", weight: 0.9, enforceable: true },
        { id: "p4", title: "Simplicity first", description: "KISS principle", category: "quality", weight: 0.7, enforceable: false },
        { id: "p5", title: "Security by design", description: "OWASP top 10", category: "security", weight: 0.85, enforceable: true },
      ];

      // Act
      const result = indexConstitution(ks, {
        nodeId: "constitution-1",
        constitutionVersion: "1.0.0",
        principles,
      });

      // Assert
      expect(result.documentsIndexed).toBe(5);
    });

    it("should replace old documents when reindexed (no duplicates)", () => {
      // Arrange
      const principles = [
        { id: "p1", title: "Library-first", description: "Prefer libraries over custom code", category: "architecture", weight: 0.8, enforceable: true },
      ];

      // Act — index twice
      indexConstitution(ks, { nodeId: "c1", constitutionVersion: "1.0.0", principles });
      const result2 = indexConstitution(ks, { nodeId: "c1", constitutionVersion: "1.1.0", principles });

      // Assert — second indexing replaces, doesn't duplicate
      expect(result2.documentsIndexed).toBe(1);
      const docs = ks.search("Library", 10);
      const constitutionDocs = docs.filter((d: { sourceType: string }) => d.sourceType === "constitution");
      expect(constitutionDocs.length).toBeLessThanOrEqual(1);
    });

    it("should include category and weight in document metadata", () => {
      // Arrange
      const principles = [
        { id: "p1", title: "TDD mandatory", description: "Test before code always", category: "process", weight: 1.0, enforceable: true },
      ];

      // Act
      indexConstitution(ks, { nodeId: "c1", constitutionVersion: "1.0.0", principles });

      // Assert
      const docs = ks.search("TDD mandatory", 5);
      const doc = docs.find((d: { sourceType: string }) => d.sourceType === "constitution");
      expect(doc).toBeDefined();
      expect(doc?.metadata?.category).toBe("process");
      expect(doc?.metadata?.weight).toBe(1.0);
      expect(doc?.metadata?.enforceable).toBe(true);
    });
  });
});
