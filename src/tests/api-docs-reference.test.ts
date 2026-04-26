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
 * Coverage tests for API /api/v1/docs-reference.
 * Five GETs that introspect tools, routes, and docs catalogs from the live
 * filesystem (dev mode) or a pre-computed manifest (npm-installed mode).
 *
 * Tests assert SHAPE CONTRACTS rather than exact counts because the introspection
 * runs against the real codebase and counts shift as tools/routes evolve.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/docs-reference", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /tools ─────────────────────────────────

  describe("GET /api/v1/docs-reference/tools", () => {
    it("should return 200 with tool catalog shape", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/tools");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("active");
      expect(res.body).toHaveProperty("deprecated");
      expect(res.body).toHaveProperty("tools");
      expect(Array.isArray(res.body.tools)).toBe(true);
    });

    it("should report total = active + deprecated (partition invariant)", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/tools");

      expect(res.body.total).toBe(res.body.active + res.body.deprecated);
    });

    it("should return at least one tool when introspecting a populated codebase", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/tools");

      // The codebase has 50+ MCP tools; if introspection returns zero, the
      // fallback chain (live filesystem → manifest) is broken.
      expect(res.body.tools.length).toBeGreaterThan(0);
    });
  });

  // ── GET /routes ────────────────────────────────

  describe("GET /api/v1/docs-reference/routes", () => {
    it("should return 200 with route catalog shape", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/routes");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalRouters");
      expect(res.body).toHaveProperty("totalEndpoints");
      expect(res.body).toHaveProperty("routes");
      expect(Array.isArray(res.body.routes)).toBe(true);
    });

    it("should report totalEndpoints as sum of per-router endpoint counts", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/routes");

      const summed = res.body.routes.reduce(
        (acc: number, r: { endpoints: unknown[] }) => acc + r.endpoints.length,
        0,
      );
      expect(res.body.totalEndpoints).toBe(summed);
    });

    it("should discover the agents router itself in the catalog", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/routes");

      // Self-introspection check — agents is one of the smallest routers and
      // should always be present.
      const found = res.body.routes.some(
        (r: { routerName?: string; mountPath?: string; sourceFile?: string }) =>
          r.routerName?.toLowerCase().includes("agents") ||
          r.mountPath === "/agents" ||
          r.sourceFile?.endsWith("agents.ts"),
      );
      expect(found).toBe(true);
    });
  });

  // ── GET /stats ─────────────────────────────────

  describe("GET /api/v1/docs-reference/stats", () => {
    it("should return 200 with aggregated stats shape", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference/stats");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        tools: { active: expect.any(Number), deprecated: expect.any(Number) },
        routes: { routers: expect.any(Number), endpoints: expect.any(Number) },
        docs: expect.any(Number),
      });
    });

    it("should be consistent with /tools and /routes when called in sequence", async () => {
      const tools = await request(ctx.app).get("/api/v1/docs-reference/tools");
      const routes = await request(ctx.app).get("/api/v1/docs-reference/routes");
      const stats = await request(ctx.app).get("/api/v1/docs-reference/stats");

      expect(stats.body.tools.active).toBe(tools.body.active);
      expect(stats.body.tools.deprecated).toBe(tools.body.deprecated);
      expect(stats.body.routes.routers).toBe(routes.body.totalRouters);
      expect(stats.body.routes.endpoints).toBe(routes.body.totalEndpoints);
    });
  });

  // ── GET / (list docs) ──────────────────────────

  describe("GET /api/v1/docs-reference", () => {
    it("should return 200 with docs array", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("docs");
      expect(Array.isArray(res.body.docs)).toBe(true);
    });

    it("each discovered doc should have slug, title, and category fields", async () => {
      const res = await request(ctx.app).get("/api/v1/docs-reference");

      // Empty docs array is acceptable (some envs may have no docs/),
      // but if there are docs, they must conform to the schema.
      for (const doc of res.body.docs) {
        expect(doc).toHaveProperty("slug");
        expect(doc).toHaveProperty("title");
        expect(doc).toHaveProperty("category");
      }
    });
  });

  // ── GET /:category/:slug ───────────────────────

  describe("GET /api/v1/docs-reference/:category/:slug", () => {
    it("should return 404 with structured error for non-existent doc", async () => {
      const res = await request(ctx.app).get(
        "/api/v1/docs-reference/no-such-category/no-such-slug",
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/not found/i);
      expect(res.body.error).toContain("no-such-category/no-such-slug");
    });

    it("should serve an existing markdown doc when one is present in /docs", async () => {
      // First discover what's available. If nothing is, skip — env may not
      // have docs/ on disk.
      const list = await request(ctx.app).get("/api/v1/docs-reference");
      const docs = list.body.docs as Array<{ slug: string }>;
      if (docs.length === 0) return;

      const first = docs[0];
      const [category, slug] = first.slug.split("/");
      const res = await request(ctx.app).get(
        `/api/v1/docs-reference/${category}/${slug}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("slug", first.slug);
      expect(res.body).toHaveProperty("content");
      expect(typeof res.body.content).toBe("string");
      expect(res.body.content.length).toBeGreaterThan(0);
    });
  });
});
