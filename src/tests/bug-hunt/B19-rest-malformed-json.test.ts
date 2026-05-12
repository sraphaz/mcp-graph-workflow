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
 * Commercial licenses and contact information are available — see COMMERCIAL.md.
 */

/**
 * B19 (P1): REST POST com Content-Type application/json e body malformado
 * deve responder 400 com JSON {error,details}, não HTML stack trace.
 *
 * §bug-hunt node_50f68e898f02
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "../helpers/test-app.js";

describe("B19 — REST malformed JSON returns JSON 400", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("POST /api/v1/nodes with non-JSON body returns 400 application/json", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/nodes")
      .set("Content-Type", "application/json")
      .send("not-json");

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
    expect(res.text).not.toMatch(/<!DOCTYPE/i);
  });

  it("POST /api/v1/edges with malformed JSON body returns 400 application/json", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/edges")
      .set("Content-Type", "application/json")
      .send("{invalid");

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("error");
    expect(res.text).not.toMatch(/<!DOCTYPE/i);
  });

  it("malformed JSON error message does not expose a raw stack trace", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/nodes")
      .set("Content-Type", "application/json")
      .send("{broken");

    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/at Object\./);
    expect(res.body.error).not.toMatch(/at process\./);
  });
});
