/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-18.AC6 — API /economy/evals tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { createEvalsRouter } from "../api/routes/evals.js";
import type { StoreRef } from "../core/store/store-manager.js";

function makeApp() {
  const db = new Database(":memory:");
  runMigrations(db);
  const fakeStore = { getDb: () => db } as { getDb: () => Database.Database };
  const storeRef = { current: fakeStore } as unknown as StoreRef;
  const app = express();
  app.use(express.json());
  app.use("/api/evals", createEvalsRouter(storeRef));
  return { app, db };
}

function seedRun(db: Database.Database, opts: {
  goldenId: string;
  runId: string;
  passed: boolean;
  cost?: number;
  ts?: string;
  model?: string;
  tool?: string;
}) {
  db.prepare(
    `INSERT OR IGNORE INTO eval_golden (id, input, expected, scorer_kind, tool, project_id, metadata, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.goldenId,
    "input",
    "expected",
    "exact",
    opts.tool ?? "implement",
    "p1",
    "{}",
    "[]",
    opts.ts ?? "2026-04-01T00:00:00Z",
  );
  db.prepare(
    `INSERT INTO eval_run (id, run_id, golden_id, score, passed, latency_ms, model_used, cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `${opts.runId}-${opts.goldenId}-${Math.random().toString(36).slice(2, 8)}`,
    opts.runId,
    opts.goldenId,
    opts.passed ? 1.0 : 0.0,
    opts.passed ? 1 : 0,
    100,
    opts.model ?? "haiku",
    opts.cost ?? 0.0001,
    opts.ts ?? "2026-04-01T00:00:00Z",
  );
}

describe("API /api/evals (E18.AC6)", () => {
  let app: express.Application;
  let db: Database.Database;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  it("returns empty summary when no eval rows exist", async () => {
    const r = await request(app).get("/api/evals/summary");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      totalRuns: 0,
      totalGoldens: 0,
      passRate: 0,
    });
    expect(Array.isArray(r.body.trend)).toBe(true);
    expect(Array.isArray(r.body.topFailing)).toBe(true);
  });

  it("aggregates passRate and totalCostUsd across runs", async () => {
    seedRun(db, { goldenId: "g1", runId: "r1", passed: true, cost: 0.001 });
    seedRun(db, { goldenId: "g2", runId: "r1", passed: false, cost: 0.002 });
    seedRun(db, { goldenId: "g1", runId: "r2", passed: true, cost: 0.001 });

    const r = await request(app).get("/api/evals/summary");
    expect(r.status).toBe(200);
    expect(r.body.totalGoldens).toBe(2);
    expect(r.body.totalRuns).toBe(2);
    expect(r.body.passRate).toBeCloseTo(2 / 3, 5);
    expect(r.body.totalCostUsd).toBeCloseTo(0.004, 5);
  });

  it("surfaces top-failing goldens", async () => {
    // g_bad fails 3/3, g_ok passes 3/3
    for (let i = 0; i < 3; i++) {
      seedRun(db, { goldenId: "g_bad", runId: `rb${i}`, passed: false });
      seedRun(db, { goldenId: "g_ok", runId: `rk${i}`, passed: true });
    }
    const r = await request(app).get("/api/evals/summary?topFailingLimit=5");
    expect(r.status).toBe(200);
    const top = r.body.topFailing as Array<{ goldenId: string; failures: number }>;
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].goldenId).toBe("g_bad");
    expect(top[0].failures).toBe(3);
  });

  it("400 on invalid trendDays", async () => {
    const r = await request(app).get("/api/evals/summary?trendDays=-1");
    expect(r.status).toBe(400);
    expect(r.body.error).toBeDefined();
  });

  it("400 on non-numeric topFailingLimit", async () => {
    const r = await request(app).get("/api/evals/summary?topFailingLimit=abc");
    expect(r.status).toBe(400);
  });
});
