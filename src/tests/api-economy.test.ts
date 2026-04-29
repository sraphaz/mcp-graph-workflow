/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T13 — API /api/economy tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createEconomyRouter } from "../api/routes/economy.js";

function makeApp(initialSize = 5) {
  let size = initialSize;
  const app = express();
  app.use(express.json());
  app.use(
    "/economy",
    createEconomyRouter({
      cache: {
        size: () => size,
        invalidateAll: () => {
          const prev = size;
          size = 0;
          return prev;
        },
      },
    }),
  );
  return app;
}

describe("API /economy (E6.T13)", () => {
  let app: express.Application;

  beforeEach(() => {
    app = makeApp(5);
  });

  describe("GET /economy/stats", () => {
    it("returns cache size and booster registry", async () => {
      const r = await request(app).get("/economy/stats");
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        cache: { size: 5 },
        boosters: { count: 6 },
      });
      expect(Array.isArray(r.body.boosters.names)).toBe(true);
      expect(r.body.boosters.names).toContain("var-to-const");
    });
  });

  describe("POST /economy/cache/clear", () => {
    it("invalidates the cache and reports cleared count", async () => {
      const r = await request(app).post("/economy/cache/clear");
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ cleared: 5 });
      const after = await request(app).get("/economy/stats");
      expect(after.body.cache.size).toBe(0);
    });
  });

  describe("GET /economy/router/explain", () => {
    it("tier1 + small budget → haiku", async () => {
      const r = await request(app).get("/economy/router/explain?tier=tier1&tokenBudget=1000");
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ tier: "tier1", model: "haiku" });
    });

    it("tier1 + large budget → sonnet", async () => {
      const r = await request(app).get("/economy/router/explain?tier=tier1&tokenBudget=16000");
      expect(r.body.model).toBe("sonnet");
    });

    it("tier2 → opus", async () => {
      const r = await request(app).get("/economy/router/explain?tier=tier2");
      expect(r.body.model).toBe("opus");
    });

    it("400 on missing tier", async () => {
      const r = await request(app).get("/economy/router/explain");
      expect(r.status).toBe(400);
      expect(r.body.error).toBeDefined();
    });

    it("400 on invalid tier value", async () => {
      const r = await request(app).get("/economy/router/explain?tier=tier99");
      expect(r.status).toBe(400);
    });
  });

  describe("POST /economy/booster/run", () => {
    it("runs a known booster and returns transformed output", async () => {
      const r = await request(app)
        .post("/economy/booster/run")
        .send({ boosterName: "var-to-const", source: "var x = 1;\nconsole.log(x);" });
      expect(r.status).toBe(200);
      expect(r.body.booster).toBe("var-to-const");
      expect(r.body.output).toContain("const x = 1");
    });

    it("404 for unknown booster", async () => {
      const r = await request(app)
        .post("/economy/booster/run")
        .send({ boosterName: "no-such", source: "x" });
      expect(r.status).toBe(404);
      expect(r.body.known).toContain("var-to-const");
    });

    it("400 when source missing", async () => {
      const r = await request(app)
        .post("/economy/booster/run")
        .send({ boosterName: "var-to-const" });
      expect(r.status).toBe(400);
    });
  });
});
