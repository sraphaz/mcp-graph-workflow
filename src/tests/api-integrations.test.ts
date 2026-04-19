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
 * Integration tests for API integrations routes.
 * Tests the full HTTP request path: Express → router → core modules.
 * Uses real in-memory SQLite store — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/integrations", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /integrations/status ────────────────────

  describe("GET /api/v1/integrations/status", () => {
    it("should return status object with codeGraph, memories, playwright keys", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("codeGraph");
      expect(res.body).toHaveProperty("memories");
      expect(res.body).toHaveProperty("playwright");
    });

    it("should have correct shape for each integration", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/status");

      expect(typeof res.body.codeGraph.installed).toBe("boolean");
      expect(typeof res.body.codeGraph.running).toBe("boolean");
      expect(typeof res.body.memories.available).toBe("boolean");
      expect(typeof res.body.memories.count).toBe("number");
    });
  });

  // ── GET /integrations/memories ───────────────────

  describe("GET /api/v1/integrations/memories", () => {
    it("should return array (possibly empty if no memories dir)", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/memories");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("each memory should have name and content fields", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/memories");

      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("name");
        expect(res.body[0]).toHaveProperty("content");
        expect(typeof res.body[0].name).toBe("string");
        expect(typeof res.body[0].content).toBe("string");
      }
    });
  });

  // ── GET /integrations/memories/:name ─────────────

  describe("GET /api/v1/integrations/memories/:name", () => {
    it("should return 404 for non-existent memory", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/memories/nonexistent-xyz");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });
  });

  // ── Backward compat: /serena/memories ────────────

  describe("GET /api/v1/integrations/serena/memories (backward compat)", () => {
    it("should still return array via deprecated endpoint", async () => {
      const res = await request(ctx.app).get("/api/v1/integrations/serena/memories");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── GET /integrations/knowledge-status ──────────

  describe("GET /api/v1/integrations/knowledge-status", () => {
    it("should return knowledge status with total count", async () => {
      const res = await request(ctx.app)
        .get("/api/v1/integrations/knowledge-status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(typeof res.body.total).toBe("number");
      expect(res.body).toHaveProperty("sources");
      expect(Array.isArray(res.body.sources)).toBe(true);
    });
  });
});
