/**
 * Tests for paginated GET /api/v1/graph endpoint.
 *
 * Task 1.1 (node_87d624d1f2b1) — Epic: API Graph Pagination
 *
 * AC1: limit/offset returns max N nodes with totalCount
 * AC2: status+type filters
 * AC3: search filter on title
 * AC4: default limit=100 offset=0
 * AC5: response includes pagination metadata
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/graph — pagination", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
    // Seed 5 nodes with varied types and statuses
    ctx.store.insertNode(makeNode({ title: "Auth middleware", type: "task", status: "backlog" }));
    ctx.store.insertNode(makeNode({ title: "Session tracker", type: "task", status: "in_progress" }));
    ctx.store.insertNode(makeNode({ title: "Database migration", type: "subtask", status: "done" }));
    ctx.store.insertNode(makeNode({ title: "Auth epic", type: "epic", status: "backlog" }));
    ctx.store.insertNode(makeNode({ title: "Session store", type: "task", status: "backlog" }));
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── AC1: Pagination ──
  describe("AC1: limit and offset", () => {
    it("should return max 2 nodes when limit=2", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.nodes.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.totalCount).toBe(5);
    });

    it("should skip nodes with offset", async () => {
      const res1 = await request(ctx.app).get("/api/v1/graph?limit=2&offset=0");
      const res2 = await request(ctx.app).get("/api/v1/graph?limit=2&offset=2");

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // Different pages should have different nodes
      const ids1 = res1.body.nodes.map((n: { id: string }) => n.id);
      const ids2 = res2.body.nodes.map((n: { id: string }) => n.id);
      const overlap = ids1.filter((id: string) => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  // ── AC2: Status and type filters ──
  describe("AC2: status and type filters", () => {
    it("should filter by status=backlog", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?status=backlog");

      expect(res.status).toBe(200);
      for (const node of res.body.nodes) {
        expect(node.status).toBe("backlog");
      }
      expect(res.body.pagination.totalCount).toBe(3); // 3 backlog nodes
    });

    it("should filter by type=task", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?type=task");

      expect(res.status).toBe(200);
      for (const node of res.body.nodes) {
        expect(node.type).toBe("task");
      }
      expect(res.body.pagination.totalCount).toBe(3); // 3 task nodes
    });

    it("should combine status+type filters", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?status=backlog&type=task");

      expect(res.status).toBe(200);
      for (const node of res.body.nodes) {
        expect(node.status).toBe("backlog");
        expect(node.type).toBe("task");
      }
      expect(res.body.pagination.totalCount).toBe(2); // Auth middleware + Session store
    });
  });

  // ── AC3: Search filter ──
  describe("AC3: search filter", () => {
    it("should filter by search term in title", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?search=session");

      expect(res.status).toBe(200);
      expect(res.body.nodes.length).toBeGreaterThanOrEqual(1);
      for (const node of res.body.nodes) {
        expect(node.title.toLowerCase()).toContain("session");
      }
    });

    it("should return empty when search has no matches", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?search=nonexistent_xyz");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(0);
      expect(res.body.pagination.totalCount).toBe(0);
    });
  });

  // ── AC4: Default pagination ──
  describe("AC4: default limit=100 offset=0", () => {
    it("should default to limit=100 when no params provided", async () => {
      const res = await request(ctx.app).get("/api/v1/graph");

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
      expect(res.body.pagination.offset).toBe(0);
      // All 5 nodes returned (< 100)
      expect(res.body.nodes).toHaveLength(5);
    });
  });

  // ── AC5: Pagination metadata ──
  describe("AC5: pagination metadata", () => {
    it("should include totalCount, hasMore, limit, offset", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBe(5);
      expect(res.body.pagination.hasMore).toBe(true);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.offset).toBe(0);
    });

    it("should set hasMore=false when all nodes returned", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?limit=100&offset=0");

      expect(res.body.pagination.hasMore).toBe(false);
    });

    it("should include edges in response", async () => {
      const res = await request(ctx.app).get("/api/v1/graph?limit=5");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.edges)).toBe(true);
    });
  });
});
