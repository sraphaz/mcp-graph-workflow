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
 * Coverage tests for API /api/v1/agents.
 * Tests the full HTTP request path: Express → router → core/insights/agent-activity.
 * Uses real in-memory SQLite store — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/agents", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/agents", () => {
    it("should return 200 with empty agents list when no team-task activity", async () => {
      const res = await request(ctx.app).get("/api/v1/agents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("agents");
      expect(Array.isArray(res.body.agents)).toBe(true);
      expect(res.body.agents).toHaveLength(0);
    });

    it("should report teamTaskEnabled=false when agents list is empty", async () => {
      const res = await request(ctx.app).get("/api/v1/agents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("teamTaskEnabled");
      expect(res.body.teamTaskEnabled).toBe(false);
    });

    it("should return application/json content type", async () => {
      const res = await request(ctx.app).get("/api/v1/agents");

      expect(res.headers["content-type"]).toMatch(/application\/json/);
    });
  });
});
