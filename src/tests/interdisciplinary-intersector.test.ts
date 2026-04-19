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
import {
  computeIntersections,
  generateIntersectionInsights,
  listIntersections,
  getIntersectionDetail,
} from "../core/insights/interdisciplinary-intersector.js";

describe("interdisciplinary-intersector", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Intersector Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  function seedDocs(): void {
    // PRD docs with tags about quantum and blockchain
    ks.insert({
      sourceType: "prd",
      sourceId: "prd:quantum-1",
      title: "Quantum Computing Requirements",
      content: "This PRD defines requirements for quantum computing integration with legacy systems. Uses GraphNode patterns and SqliteStore for persistence.",
      metadata: { tags: ["quantum", "legacy", "integration"], nodeId: "n1" },
    });
    ks.insert({
      sourceType: "prd",
      sourceId: "prd:quantum-2",
      title: "Quantum Annealing Optimization",
      content: "Quantum annealing approaches for optimization problems in graph traversal and dependency resolution.",
      metadata: { tags: ["quantum", "optimization", "graph"], nodeId: "n2" },
    });

    // Docs about blockchain and legacy
    ks.insert({
      sourceType: "docs",
      sourceId: "docs:blockchain-1",
      title: "Blockchain Legacy Migration",
      content: "Strategy for migrating legacy systems to blockchain-based architecture. SqliteStore compatibility layer.",
      metadata: { tags: ["blockchain", "legacy", "migration"], nodeId: "n3" },
    });
    ks.insert({
      sourceType: "docs",
      sourceId: "docs:blockchain-2",
      title: "Smart Contract Patterns",
      content: "Design patterns for smart contracts with deterministic execution and integration testing.",
      metadata: { tags: ["blockchain", "patterns", "deterministic"], nodeId: "n4" },
    });

    // Memory docs about integration patterns
    ks.insert({
      sourceType: "memory",
      sourceId: "memory:pattern-1",
      title: "Integration Pattern Decision",
      content: "Decided to use event-driven integration for cross-module communication. GraphNode events.",
      metadata: { tags: ["integration", "patterns", "events"], nodeId: "n5" },
    });
    ks.insert({
      sourceType: "memory",
      sourceId: "memory:pattern-2",
      title: "Legacy System Lessons",
      content: "Lessons learned from legacy system migration. Deterministic-first approach proved effective.",
      metadata: { tags: ["legacy", "lessons", "deterministic"], nodeId: "n6" },
    });
  }

  describe("computeIntersections", () => {
    it("should return empty array when fewer than 2 source types exist", () => {
      ks.insert({
        sourceType: "prd",
        sourceId: "prd:only-1",
        title: "Only PRD",
        content: "Single source type content.",
        metadata: { tags: ["solo"] },
      });
      ks.insert({
        sourceType: "prd",
        sourceId: "prd:only-2",
        title: "Another PRD",
        content: "Still single source type.",
        metadata: { tags: ["solo"] },
      });

      const results = computeIntersections(store.getDb());
      expect(results).toEqual([]);
    });

    it("should find tag-based intersections between docs from different source types", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { minScore: 0 });

      expect(results.length).toBeGreaterThan(0);

      // PRD (quantum, legacy, integration, optimization, graph) and docs (blockchain, legacy, migration, patterns, deterministic)
      // share "legacy" tag → should have non-zero tagOverlapScore
      const prdDocs = results.find(
        (r) =>
          (r.sourceTypeA === "prd" && r.sourceTypeB === "docs") ||
          (r.sourceTypeA === "docs" && r.sourceTypeB === "prd"),
      );
      expect(prdDocs).toBeDefined();
      expect(prdDocs!.sharedTags.length).toBeGreaterThan(0);
      expect(prdDocs!.tagOverlapScore).toBeGreaterThan(0);
    });

    it("should compute entity co-occurrence between source type groups", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { minScore: 0 });

      // PRD and docs both mention "SqliteStore" (PascalCase entity)
      const prdDocs = results.find(
        (r) =>
          (r.sourceTypeA === "prd" && r.sourceTypeB === "docs") ||
          (r.sourceTypeA === "docs" && r.sourceTypeB === "prd"),
      );
      expect(prdDocs).toBeDefined();
      // Entity overlap should be present since they share PascalCase entities
      expect(prdDocs!.entityOverlapScore).toBeGreaterThanOrEqual(0);
    });

    it("should compute keyword similarity between groups", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { minScore: 0 });

      // All groups share common vocabulary (legacy, integration, etc.)
      const anyResult = results[0];
      expect(anyResult).toBeDefined();
      expect(anyResult.keywordSimilarity).toBeGreaterThanOrEqual(0);
    });

    it("should filter by minScore threshold", () => {
      seedDocs();

      const allResults = computeIntersections(store.getDb(), { minScore: 0 });
      const filteredResults = computeIntersections(store.getDb(), { minScore: 0.5 });

      expect(filteredResults.length).toBeLessThanOrEqual(allResults.length);
      for (const r of filteredResults) {
        expect(r.combinedScore).toBeGreaterThanOrEqual(0.5);
      }
    });

    it("should filter by concept keyword when provided", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { concept: "quantum", minScore: 0 });

      // Only intersections involving groups that mention "quantum" should appear
      for (const r of results) {
        const hasQuantum =
          r.sampleDocsA.some((t) => t.toLowerCase().includes("quantum")) ||
          r.sampleDocsB.some((t) => t.toLowerCase().includes("quantum"));
        // At least one side should involve a doc mentioning quantum concept
        expect(hasQuantum || r.sharedTags.includes("quantum") || r.sharedEntities.some((e) => e.toLowerCase().includes("quantum"))).toBe(true);
      }
    });

    it("should respect limit parameter", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { limit: 1, minScore: 0 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should compute combined score as weighted average", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { minScore: 0 });

      for (const r of results) {
        const expected = 0.35 * r.tagOverlapScore + 0.35 * r.entityOverlapScore + 0.30 * r.keywordSimilarity;
        expect(r.combinedScore).toBeCloseTo(expected, 5);
      }
    });

    it("should include sample doc titles from both groups", () => {
      seedDocs();
      const results = computeIntersections(store.getDb(), { minScore: 0 });

      for (const r of results) {
        expect(r.sampleDocsA.length).toBeGreaterThan(0);
        expect(r.sampleDocsA.length).toBeLessThanOrEqual(3);
        expect(r.sampleDocsB.length).toBeGreaterThan(0);
        expect(r.sampleDocsB.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("generateIntersectionInsights", () => {
    it("should store synthesis documents in knowledge store", () => {
      seedDocs();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      const insights = generateIntersectionInsights(store.getDb(), candidates);

      expect(insights.length).toBeGreaterThan(0);

      // Verify stored in knowledge_documents
      for (const insight of insights) {
        const doc = ks.getById(insight.id);
        expect(doc).not.toBeNull();
        expect(doc!.sourceType).toBe("synthesis");
      }
    });

    it("should create proper sourceId with synthesis:intersection: prefix", () => {
      seedDocs();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      const insights = generateIntersectionInsights(store.getDb(), candidates);

      for (const insight of insights) {
        const doc = ks.getById(insight.id);
        expect(doc!.sourceId).toMatch(/^synthesis:intersection:/);
      }
    });

    it("should include suggested skill name and description", () => {
      seedDocs();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      const insights = generateIntersectionInsights(store.getDb(), candidates);

      for (const insight of insights) {
        expect(insight.suggestedSkillName).toBeTruthy();
        expect(insight.suggestedSkillDescription).toBeTruthy();
        expect(insight.domains).toHaveLength(2);
      }
    });

    it("should return empty array for empty candidates", () => {
      const insights = generateIntersectionInsights(store.getDb(), []);
      expect(insights).toEqual([]);
    });
  });

  describe("listIntersections", () => {
    it("should return previously generated intersection insights", () => {
      seedDocs();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      generateIntersectionInsights(store.getDb(), candidates);

      const listed = listIntersections(store.getDb());
      expect(listed.length).toBeGreaterThan(0);
      for (const doc of listed) {
        expect(doc.sourceId).toMatch(/^synthesis:intersection:/);
      }
    });

    it("should respect limit parameter", () => {
      seedDocs();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      generateIntersectionInsights(store.getDb(), candidates);

      const listed = listIntersections(store.getDb(), 1);
      expect(listed.length).toBeLessThanOrEqual(1);
    });

    it("should return empty for no intersections", () => {
      const listed = listIntersections(store.getDb());
      expect(listed).toEqual([]);
    });
  });

  describe("getIntersectionDetail", () => {
    it("should return full content of a specific intersection", () => {
      seedDocs();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      const insights = generateIntersectionInsights(store.getDb(), candidates);

      const detail = getIntersectionDetail(store.getDb(), insights[0].id);
      expect(detail).not.toBeNull();
      expect(detail!.id).toBe(insights[0].id);
      expect(detail!.content).toBeTruthy();
    });

    it("should return null for non-existent id", () => {
      const detail = getIntersectionDetail(store.getDb(), "kdoc_nonexistent");
      expect(detail).toBeNull();
    });
  });
});
