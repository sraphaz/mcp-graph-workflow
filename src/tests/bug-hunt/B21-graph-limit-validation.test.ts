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
 * B21 (P3): /api/v1/graph?limit= deve validar e rejeitar valores inválidos.
 *
 * §bug-hunt node_62ab16500cfd
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "../helpers/test-app.js";

describe("B21 — graph limit query param validation", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("rejects limit=-1 with HTTP 400 JSON", async () => {
    const res = await request(ctx.app).get("/api/v1/graph?limit=-1");
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects limit=abc with HTTP 400 JSON", async () => {
    const res = await request(ctx.app).get("/api/v1/graph?limit=abc");
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects limit=999999 with HTTP 400 JSON (above MAX_LIMIT=1000)", async () => {
    const res = await request(ctx.app).get("/api/v1/graph?limit=999999");
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("error");
  });

  it("accepts limit=50 with HTTP 200", async () => {
    const res = await request(ctx.app).get("/api/v1/graph?limit=50");
    expect(res.status).toBe(200);
  });

  it("accepts missing limit with HTTP 200 (default behaviour)", async () => {
    const res = await request(ctx.app).get("/api/v1/graph");
    expect(res.status).toBe(200);
  });
});
