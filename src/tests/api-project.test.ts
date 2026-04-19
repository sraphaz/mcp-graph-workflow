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
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/project", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/project", () => {
    it("should return the initialized project", async () => {
      const res = await request(ctx.app).get("/api/v1/project");

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Project");
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it("should return 404 when no project is initialized", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app).get("/api/v1/project");
      expect(res.status).toBe(404);
      store.close();
    });
  });

  describe("POST /api/v1/project/init", () => {
    it("should initialize a project with custom name", async () => {
      const store = SqliteStore.open(":memory:");
      const express = (await import("express")).default;
      const { createApiRouter } = await import("../api/router.js");

      const app = express();
      app.use(express.json());
      app.use("/api/v1", createApiRouter(store));

      const res = await request(app)
        .post("/api/v1/project/init")
        .send({ name: "My Project" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("My Project");
      store.close();
    });

    it("should create new project on init with different name", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/project/init")
        .send({ name: "Another Name" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Another Name");
    });

    it("should return existing project on init with same name", async () => {
      const res = await request(ctx.app)
        .post("/api/v1/project/init")
        .send({ name: "Test Project" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Test Project");
    });
  });
});
