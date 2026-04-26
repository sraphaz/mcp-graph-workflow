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
 * Coverage tests for API /api/v1/autonomy.
 * Three observability endpoints for the AAA+ pipeline (M.A.P.A. pillar A).
 * Uses real in-memory SQLite store — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/autonomy", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── GET /status ─────────────────────────────────

  describe("GET /api/v1/autonomy/status", () => {
    it("should return 200 with autopilot state shape", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("autopilotActive");
      expect(typeof res.body.autopilotActive).toBe("boolean");
    });

    it("should default autopilotActive=false when no project setting set", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      expect(res.body.autopilotActive).toBe(false);
    });

    it("should default phase='auto' when no override is set", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      expect(res.body.phase).toBe("auto");
    });

    it("should reflect project setting when autopilot_active=true", async () => {
      ctx.store.setProjectSetting("autopilot_active", "true");

      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      expect(res.body.autopilotActive).toBe(true);
    });

    it("should default gates to advisory mode", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      expect(res.body.gates).toEqual({
        testGate: "advisory",
        contractGate: "advisory",
      });
    });

    it("should report all pipeline components as wired", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      // The pipeline shape is a contract — frontend depends on these names.
      expect(res.body.pipeline).toMatchObject({
        testGateWired: true,
        contractGateWired: true,
        prefetcherWired: true,
        adaptiveBudgetWired: true,
        astPruningWired: true,
        citationsWired: true,
      });
    });

    it("should expose harnessScore and harnessGrade fields", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/status");

      expect(res.body).toHaveProperty("harnessScore");
      expect(typeof res.body.harnessScore).toBe("number");
      expect(res.body).toHaveProperty("harnessGrade");
      expect(typeof res.body.harnessGrade).toBe("string");
    });
  });

  // ── GET /session ────────────────────────────────

  describe("GET /api/v1/autonomy/session", () => {
    it("should return active=false when no autopilot session is running", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/session");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ active: false, session: null });
    });

    it("should return active=true with session details when a session is running", async () => {
      // Insert a running session directly into autopilot_sessions table
      // (table created by migration v48). Use the real store so we exercise
      // the SQL path the route depends on.
      const db = ctx.store.getDb();
      db.prepare(
        `INSERT INTO autopilot_sessions
          (id, sprint_id, started_at, status, tasks_completed, tasks_failed, tokens_used, config)
         VALUES (?, ?, ?, 'running', 0, 0, 0, ?)`,
      ).run(
        "session-1",
        "sprint-1",
        new Date().toISOString(),
        JSON.stringify({ maxTasks: 10 }),
      );

      const res = await request(ctx.app).get("/api/v1/autonomy/session");

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(true);
      expect(res.body.session).toMatchObject({
        id: "session-1",
        sprintId: "sprint-1",
        status: "running",
        tasksCompleted: 0,
        tasksFailed: 0,
        tokensUsed: 0,
      });
      // config is JSON-parsed by the route, not returned as a string.
      expect(res.body.session.config).toEqual({ maxTasks: 10 });
    });

    it("should ignore non-running sessions (e.g. status='completed')", async () => {
      const db = ctx.store.getDb();
      db.prepare(
        `INSERT INTO autopilot_sessions
          (id, sprint_id, started_at, status, tasks_completed, tasks_failed, tokens_used, config)
         VALUES (?, ?, ?, 'completed', 0, 0, 0, '{}')`,
      ).run("session-done", "sprint-x", new Date().toISOString());

      const res = await request(ctx.app).get("/api/v1/autonomy/session");

      expect(res.body.active).toBe(false);
      expect(res.body.session).toBeNull();
    });
  });

  // ── GET /budget ─────────────────────────────────

  describe("GET /api/v1/autonomy/budget", () => {
    it("should return 200 with adaptive budget distribution shape", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/budget");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("phase");
      expect(res.body).toHaveProperty("distribution");
      expect(res.body).toHaveProperty("preset");
      expect(res.body).toHaveProperty("source");
      expect(res.body).toHaveProperty("qLearning");
    });

    it("should default phase to IMPLEMENT when no override is set", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/budget");

      expect(res.body.phase).toBe("IMPLEMENT");
    });

    it("should reflect lifecycle_phase_override project setting", async () => {
      ctx.store.setProjectSetting("lifecycle_phase_override", "DESIGN");

      const res = await request(ctx.app).get("/api/v1/autonomy/budget");

      expect(res.body.phase).toBe("DESIGN");
    });

    it("should partition the 4000-token base budget across 4 buckets", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/budget");

      const { graph, knowledge, code, history } = res.body.distribution;
      expect(graph).toBeGreaterThanOrEqual(0);
      expect(knowledge).toBeGreaterThanOrEqual(0);
      expect(code).toBeGreaterThanOrEqual(0);
      expect(history).toBeGreaterThanOrEqual(0);

      // Sum should equal the base (4000) — exact split comes from
      // getAdaptiveBudgetSplit; test asserts the partition invariant.
      const total = graph + knowledge + code + history;
      expect(total).toBe(4000);
    });

    it("should include qLearning stats with totalVisits and convergenceRate", async () => {
      const res = await request(ctx.app).get("/api/v1/autonomy/budget");

      expect(res.body.qLearning).toHaveProperty("totalVisits");
      expect(res.body.qLearning).toHaveProperty("convergenceRate");
      expect(typeof res.body.qLearning.totalVisits).toBe("number");
      expect(typeof res.body.qLearning.convergenceRate).toBe("number");
    });
  });
});
