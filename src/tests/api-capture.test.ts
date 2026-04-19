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
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("POST /api/v1/capture", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("should return 400 when URL is missing", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({});

    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid URL", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({ url: "not-a-url" });

    expect(res.status).toBe(400);
  });

  it("should accept valid capture request shape", async () => {
    // This test validates the request validation passes for a valid shape.
    // The actual capture may fail (no browser) but should not return 400.
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({ url: "https://example.com" });

    // Should NOT be 400 (validation error). It may be 500 if Playwright isn't available.
    expect(res.status).not.toBe(400);
  });

  it("should accept optional selector parameter", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/capture")
      .send({ url: "https://example.com", selector: "main" });

    expect(res.status).not.toBe(400);
  });
});
