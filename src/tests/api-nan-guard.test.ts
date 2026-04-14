/**
 * Tests for NaN/invalid input guards in API routes.
 * E2-T01: siebel route parseInt guard
 * E2-T02: code-graph route parseInt guard
 * E2-T03: knowledge route Number guard
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API NaN guards — invalid query params return 400", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── E2-T01: siebel /objects ────────────────────

  describe("GET /api/v1/siebel/objects — limit/offset validation", () => {
    it("should return 400 when limit is non-numeric", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/objects?limit=abc");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when offset is non-numeric", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/objects?offset=xyz");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when limit is negative", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/objects?limit=-1");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when offset is negative", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/objects?offset=-5");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 200 with valid numeric limit and offset", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/objects?limit=10&offset=0");
      expect(res.status).toBe(200);
    });

    it("should use defaults (limit=50, offset=0) when not provided", async () => {
      const res = await request(ctx.app).get("/api/v1/siebel/objects");
      expect(res.status).toBe(200);
    });
  });

  // ── E2-T02: code-graph /full ───────────────────

  describe("GET /api/v1/code-graph/full — limit/offset validation", () => {
    it("should return 400 when limit is non-numeric", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full?limit=abc");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when offset is non-numeric", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full?offset=xyz");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when limit is negative", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full?limit=-1");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 200 with valid params", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full?limit=100&offset=0");
      expect(res.status).toBe(200);
    });

    it("should return 200 with no params (defaults)", async () => {
      const res = await request(ctx.app).get("/api/v1/code-graph/full");
      expect(res.status).toBe(200);
    });
  });

  // ── E2-T03: knowledge / ────────────────────────

  describe("GET /api/v1/knowledge — limit/offset validation", () => {
    it("should return 400 when limit is non-numeric", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge?limit=abc");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when offset is non-numeric", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge?offset=xyz");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 400 when limit is negative", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge?limit=-5");
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("should return 200 when limit is valid", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge?limit=10");
      expect(res.status).toBe(200);
    });

    it("should return 200 when no limit/offset provided", async () => {
      const res = await request(ctx.app).get("/api/v1/knowledge");
      expect(res.status).toBe(200);
    });
  });
});
