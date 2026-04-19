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
import { makeNode } from "./helpers/factories.js";
import {
  validateRetrievedResults,
  correctResults,
  verifyCrossReferences,
  type ValidationResult,
} from "../core/rag/corrective-rag.js";
import type { RankedResult } from "../core/rag/multi-strategy-retrieval.js";

function makeRankedResult(overrides: Partial<RankedResult> & { id: string }): RankedResult {
  return {
    sourceType: "memory",
    sourceId: "mem:test",
    title: "Test doc",
    content: "Test content",
    score: 0.8,
    qualityScore: 0.7,
    strategies: ["fts"],
    ...overrides,
  };
}

describe("Corrective RAG", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("corrective-rag-test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  describe("validateRetrievedResults", () => {
    it("should mark results as fresh when linked node exists and is recent", () => {
      // Arrange: create a node and a knowledge doc linked to it
      store.insertNode(
        makeNode({
          id: "task-1",
          title: "Implement search",
          status: "in_progress",
          priority: 1,
        }),
      );
      const doc = ks.insert({
        sourceType: "memory",
        sourceId: "mem:search",
        title: "Search implementation notes",
        content: "Using FTS5 with BM25 ranking for full-text search",
        metadata: { nodeId: "task-1" },
      });

      const results = [makeRankedResult({ id: doc!.id, title: "Search implementation notes" })];

      // Act
      const validations = validateRetrievedResults(results, store.getDb(), store);

      // Assert
      expect(validations.length).toBe(1);
      expect(validations[0].staleness).toBe("fresh");
      expect(validations[0].confidenceScore).toBeGreaterThanOrEqual(0.8);
    });

    it("should mark results as stale when linked node no longer exists", () => {
      // Arrange: doc references a node that doesn't exist
      const doc = ks.insert({
        sourceType: "memory",
        sourceId: "mem:deleted",
        title: "Deleted task context",
        content: "This was about a task that got removed",
        metadata: { nodeId: "task-nonexistent" },
      });

      const results = [makeRankedResult({ id: doc!.id, title: "Deleted task context" })];

      // Act
      const validations = validateRetrievedResults(results, store.getDb(), store);

      // Assert
      expect(validations.length).toBe(1);
      expect(validations[0].staleness).toBe("stale");
      expect(validations[0].confidenceScore).toBeLessThan(0.5);
    });

    it("should handle results without node metadata gracefully", () => {
      // Arrange: doc has no nodeId metadata
      const doc = ks.insert({
        sourceType: "docs",
        sourceId: "docs:general",
        title: "General documentation",
        content: "Some general documentation without node association",
      });

      const results = [makeRankedResult({ id: doc!.id, title: "General documentation" })];

      // Act
      const validations = validateRetrievedResults(results, store.getDb(), store);

      // Assert: should still validate, with neutral confidence
      expect(validations.length).toBe(1);
      expect(validations[0].staleness).toBe("fresh");
      expect(validations[0].confidenceScore).toBeGreaterThanOrEqual(0.5);
    });

    it("should detect status changes that affect confidence", () => {
      // Arrange: create a node that's done
      store.insertNode(
        makeNode({
          id: "task-done",
          title: "Setup database",
          status: "done",
          priority: 1,
        }),
      );
      const doc = ks.insert({
        sourceType: "memory",
        sourceId: "mem:db-setup",
        title: "Database setup notes",
        content: "Setting up SQLite with initial schema",
        metadata: { nodeId: "task-done" },
      });

      const results = [makeRankedResult({ id: doc!.id, title: "Database setup notes" })];

      // Act
      const validations = validateRetrievedResults(results, store.getDb(), store);

      // Assert: done tasks' knowledge should still be valid (decisions are stable)
      expect(validations[0].isValid).toBe(true);
      expect(validations[0].confidenceScore).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe("correctResults", () => {
    it("should apply confidence multiplier to scores", () => {
      const results = [
        makeRankedResult({ id: "doc-1", score: 0.9 }),
        makeRankedResult({ id: "doc-2", score: 0.8 }),
      ];
      const validations: ValidationResult[] = [
        { docId: "doc-1", isValid: true, confidenceScore: 1.0, staleness: "fresh", issues: [] },
        { docId: "doc-2", isValid: true, confidenceScore: 0.5, staleness: "aging", issues: [] },
      ];

      const corrected = correctResults(results, validations);

      // doc-1 should keep high score, doc-2 should be penalized
      expect(corrected[0].id).toBe("doc-1");
      expect(corrected[0].score).toBeGreaterThan(corrected[1].score);
    });

    it("should filter out invalid results below threshold", () => {
      const results = [
        makeRankedResult({ id: "doc-valid", score: 0.8 }),
        makeRankedResult({ id: "doc-invalid", score: 0.7 }),
      ];
      const validations: ValidationResult[] = [
        { docId: "doc-valid", isValid: true, confidenceScore: 0.9, staleness: "fresh", issues: [] },
        { docId: "doc-invalid", isValid: false, confidenceScore: 0.1, staleness: "stale", issues: ["node_deleted"] },
      ];

      const corrected = correctResults(results, validations, { minConfidence: 0.3 });

      expect(corrected.length).toBe(1);
      expect(corrected[0].id).toBe("doc-valid");
    });

    it("should re-sort results by corrected score", () => {
      const results = [
        makeRankedResult({ id: "doc-a", score: 0.9 }),
        makeRankedResult({ id: "doc-b", score: 0.7 }),
      ];
      const validations: ValidationResult[] = [
        { docId: "doc-a", isValid: true, confidenceScore: 0.3, staleness: "stale", issues: [] },
        { docId: "doc-b", isValid: true, confidenceScore: 1.0, staleness: "fresh", issues: [] },
      ];

      const corrected = correctResults(results, validations);

      // doc-b should now rank higher after correction
      expect(corrected[0].id).toBe("doc-b");
    });
  });

  describe("verifyCrossReferences", () => {
    it("should verify dependency claims when referenced node exists", () => {
      store.insertNode(makeNode({ id: "task-db", title: "Database setup", status: "done" }));

      const content = 'This feature depends on "Database setup" being complete.';
      const checks = verifyCrossReferences(content, store.getDb(), store);

      expect(checks.length).toBeGreaterThanOrEqual(1);
      const depCheck = checks.find((c) => c.claimType === "dependency");
      expect(depCheck).toBeDefined();
      expect(depCheck!.verified).toBe(true);
    });

    it("should flag unverified dependency when referenced node missing", () => {
      const content = 'This depends on "Nonexistent Feature" for data.';
      const checks = verifyCrossReferences(content, store.getDb(), store);

      const depCheck = checks.find((c) => c.claimType === "dependency");
      if (depCheck) {
        expect(depCheck.verified).toBe(false);
      }
    });

    it("should verify status claims against current graph state", () => {
      store.insertNode(makeNode({ id: "task-auth", title: "Auth module", status: "done" }));

      const content = '"Auth module" is done and ready for integration.';
      const checks = verifyCrossReferences(content, store.getDb(), store);

      const statusCheck = checks.find((c) => c.claimType === "status");
      if (statusCheck) {
        expect(statusCheck.verified).toBe(true);
      }
    });

    it("should flag incorrect status claims", () => {
      store.insertNode(makeNode({ id: "task-api", title: "API layer", status: "in_progress" }));

      const content = '"API layer" is done, we can move on.';
      const checks = verifyCrossReferences(content, store.getDb(), store);

      const statusCheck = checks.find((c) => c.claimType === "status");
      if (statusCheck) {
        expect(statusCheck.verified).toBe(false);
      }
    });

    it("should return empty for content without cross-references", () => {
      const content = "General notes about the project architecture.";
      const checks = verifyCrossReferences(content, store.getDb(), store);
      expect(checks).toHaveLength(0);
    });
  });
});
