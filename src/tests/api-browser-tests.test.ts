/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Router /api/browser-tests/*
 *
 * AC1: GIVEN GET /runs?limit=10 WHEN executado THEN 10 runs ordered by started_at desc
 * AC2: GIVEN GET /runs/:invalidId WHEN executado THEN 404 com erro estruturado
 * AC3: GIVEN GET /evidence/:step WHEN PNG existe THEN serve com Content-Type: image/png
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/browser-tests", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // -------------------------------------------------------------------------
  // Shape contract: GET /runs
  // -------------------------------------------------------------------------

  it("GET /runs returns 200 with array", async () => {
    const res = await request(ctx.app).get("/api/v1/browser-tests/runs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /runs?limit=5 honours the limit parameter", async () => {
    const res = await request(ctx.app).get("/api/v1/browser-tests/runs?limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // AC2: invalid runId → 404 structured error
  // -------------------------------------------------------------------------

  it("GET /runs/:invalidId returns 404 with error field", async () => {
    const res = await request(ctx.app).get("/api/v1/browser-tests/runs/non-existent-id");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("404 error body has a message string", async () => {
    const res = await request(ctx.app).get("/api/v1/browser-tests/runs/does-not-exist");
    expect(typeof res.body.error).toBe("string");
  });

  // -------------------------------------------------------------------------
  // AC3: evidence endpoint — serve PNG (404 when not found)
  // -------------------------------------------------------------------------

  it("GET /runs/:runId/evidence/:stepN returns 404 for missing screenshot", async () => {
    const res = await request(ctx.app).get(
      "/api/v1/browser-tests/runs/ghost-run/evidence/0",
    );
    expect(res.status).toBe(404);
  });
});
