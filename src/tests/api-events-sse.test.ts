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
 * Coverage tests for API /api/v1/events.
 * Three GETs: / (SSE), /stream (SSE), /clients (count).
 *
 * Without an EventBus, the SSE endpoints must surface a structured 503 rather
 * than hanging the connection. The /clients endpoint always returns the
 * current connected-client count.
 *
 * SSE stream behavior (with EventBus) is exercised end-to-end in dashboard
 * integration tests; here we focus on the contract surface.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/events (SSE)", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/events (root SSE)", () => {
    it("should return 503 when no EventBus is wired (test app default)", async () => {
      const res = await request(ctx.app).get("/api/v1/events");

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/EventBus/);
    });
  });

  describe("GET /api/v1/events/stream", () => {
    it("should return 503 when no EventBus is wired (test app default)", async () => {
      const res = await request(ctx.app).get("/api/v1/events/stream");

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/EventBus/);
    });
  });

  describe("GET /api/v1/events/clients", () => {
    it("should return 200 with connected client count", async () => {
      const res = await request(ctx.app).get("/api/v1/events/clients");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("count");
      expect(typeof res.body.count).toBe("number");
      expect(res.body.count).toBeGreaterThanOrEqual(0);
    });

    it("should not require an EventBus to report client count", async () => {
      // Even when SSE endpoints would 503 (no EventBus), /clients works
      // because client tracking is independent of the bus wiring.
      const sse = await request(ctx.app).get("/api/v1/events");
      expect(sse.status).toBe(503);

      const clients = await request(ctx.app).get("/api/v1/events/clients");
      expect(clients.status).toBe(200);
    });
  });
});
