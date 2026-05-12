/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_eb599ae9cec2 — Story 9 AC: GET /api/v1/health returns { status, checks:[...] }
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("Story 9 AC — GET /api/v1/health is mounted and returns health shape", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("GET /api/v1/health returns 200 or 503 (not 404)", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    expect(res.status).not.toBe(404);
  });

  it("GET /api/v1/health returns { status } field", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    expect(typeof res.body.status).toBe("string");
    expect(["ok", "error"]).toContain(res.body.status);
  });

  it("GET /api/v1/health returns { checks: [...] } array", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    expect(Array.isArray(res.body.checks)).toBe(true);
    expect(res.body.checks.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/health checks include DB (sqlite-database), config (config-file), and fs (write-permissions)", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    const names = (res.body.checks as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain("sqlite-database");
    expect(names).toContain("config-file");
    expect(names).toContain("write-permissions");
  });

  it("GET /api/v1/health/live returns 200 { status: 'ok' }", async () => {
    const res = await request(ctx.app).get("/api/v1/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
