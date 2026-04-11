import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import {
  computeIntersections,
  generateIntersectionInsights,
  listIntersections,
  getIntersectionDetail,
} from "../core/insights/interdisciplinary-intersector.js";

/**
 * Integration tests for the intersect_knowledge MCP tool logic.
 * Tests the core functions that the tool wraps (tool registration
 * requires McpServer which is tested separately via E2E).
 */
describe("intersect-knowledge tool logic", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Tool Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  function seedKnowledge(): void {
    ks.insert({
      sourceType: "prd",
      sourceId: "prd:a1",
      title: "API Design Requirements",
      content: "RESTful API design patterns with authentication and caching strategy for SqliteStore.",
      metadata: { tags: ["api", "design", "rest"] },
    });
    ks.insert({
      sourceType: "prd",
      sourceId: "prd:a2",
      title: "Graph Traversal PRD",
      content: "Graph traversal algorithms for dependency resolution using GraphNode patterns.",
      metadata: { tags: ["graph", "algorithms", "traversal"] },
    });
    ks.insert({
      sourceType: "docs",
      sourceId: "docs:b1",
      title: "Authentication Docs",
      content: "OAuth and JWT authentication patterns for REST API integration.",
      metadata: { tags: ["api", "auth", "rest"] },
    });
    ks.insert({
      sourceType: "docs",
      sourceId: "docs:b2",
      title: "Caching Strategy Guide",
      content: "Redis and in-memory caching patterns for performance optimization.",
      metadata: { tags: ["caching", "performance", "patterns"] },
    });
  }

  describe("discover action", () => {
    it("should return insights when cross-domain intersections exist", () => {
      seedKnowledge();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      expect(candidates.length).toBeGreaterThan(0);

      const insights = generateIntersectionInsights(store.getDb(), candidates);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].domains).toHaveLength(2);
      expect(insights[0].suggestedSkillName).toBeTruthy();
    });

    it("should return empty insights for insufficient data", () => {
      ks.insert({
        sourceType: "prd",
        sourceId: "prd:only",
        title: "Lonely PRD",
        content: "Only one source type.",
        metadata: { tags: ["solo"] },
      });
      ks.insert({
        sourceType: "prd",
        sourceId: "prd:only2",
        title: "Still Lonely",
        content: "Same type.",
        metadata: { tags: ["solo"] },
      });

      const candidates = computeIntersections(store.getDb());
      expect(candidates).toEqual([]);
    });
  });

  describe("list action", () => {
    it("should return previously generated intersections", () => {
      seedKnowledge();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      generateIntersectionInsights(store.getDb(), candidates);

      const listed = listIntersections(store.getDb());
      expect(listed.length).toBeGreaterThan(0);
      for (const doc of listed) {
        expect(doc.sourceId).toMatch(/^synthesis:intersection:/);
        expect(doc.sourceType).toBe("synthesis");
      }
    });
  });

  describe("detail action", () => {
    it("should return full document for valid id", () => {
      seedKnowledge();
      const candidates = computeIntersections(store.getDb(), { minScore: 0 });
      const insights = generateIntersectionInsights(store.getDb(), candidates);

      const detail = getIntersectionDetail(store.getDb(), insights[0].id);
      expect(detail).not.toBeNull();
      expect(detail!.content).toContain("Intersection:");
      expect(detail!.content).toContain("Score:");
    });

    it("should return null for invalid id", () => {
      const detail = getIntersectionDetail(store.getDb(), "kdoc_invalid");
      expect(detail).toBeNull();
    });
  });
});
