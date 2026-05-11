/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-observability — Task 3.1: GET /api/observability/metrics
 *
 * AC1: GIVEN GET com `window=1h` WHEN executado THEN retorna métricas agregadas
 * AC2: GIVEN sem dados WHEN GET THEN retorna estrutura vazia explícita
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { createObservabilityRouter } from "../api/routes/observability.js";

function makeApp(db: Database.Database) {
  const app = express();
  app.use(express.json());
  app.use("/api/observability", createObservabilityRouter(db));
  return app;
}

function insertEvent(
  db: Database.Database,
  opts: {
    id?: string;
    kind?: string;
    sessionId?: string;
    durationMs?: number;
    timestamp?: string;
    payload?: Record<string, unknown>;
  },
) {
  const id = opts.id ?? `evt_${Math.random().toString(36).slice(2)}`;
  const ts = opts.timestamp ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO events (id, kind, subjectRef_kind, subjectRef_id, sessionId, timestamp, durationMs, payload, projectId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.kind ?? "tool.call",
    "tool",
    "test",
    opts.sessionId ?? null,
    ts,
    opts.durationMs ?? null,
    opts.payload ? JSON.stringify(opts.payload) : null,
    "p1",
  );
}

describe("GET /api/observability/metrics — AC2: empty state", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("AC2: returns 200 with explicit empty structure when no data", async () => {
    const res = await request(makeApp(db)).get("/api/observability/metrics");
    expect(res.status).toBe(200);
    const body = res.body as { byKind: unknown; activeSessions: unknown; callsPerMin: unknown };
    expect(body.byKind).toBeDefined();
    expect(body.activeSessions).toBeDefined();
    expect(typeof body.callsPerMin).toBe("number");
  });

  it("AC2: byKind is empty object when no events", async () => {
    const res = await request(makeApp(db)).get("/api/observability/metrics");
    expect(res.body.byKind).toEqual({});
  });

  it("AC2: activeSessions is empty array when no events", async () => {
    const res = await request(makeApp(db)).get("/api/observability/metrics");
    expect(res.body.activeSessions).toEqual([]);
  });
});

describe("GET /api/observability/metrics — AC1: with data and window param", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("AC1: returns metrics with window=1h query param", async () => {
    insertEvent(db, { kind: "tool.call", durationMs: 100, sessionId: "sess1" });
    insertEvent(db, { kind: "tool.call", durationMs: 200, sessionId: "sess1" });

    const res = await request(makeApp(db)).get("/api/observability/metrics?window=1h");
    expect(res.status).toBe(200);
    expect(res.body.windowMs).toBe(3600000);
  });

  it("AC1: byKind contains entry for each event kind with count", async () => {
    insertEvent(db, { kind: "tool.call", durationMs: 50 });
    insertEvent(db, { kind: "tool.call", durationMs: 80 });
    insertEvent(db, { kind: "node.update", durationMs: 30 });

    const res = await request(makeApp(db)).get("/api/observability/metrics?window=1h");
    expect((res.body.byKind as Record<string, { count: number }>)["tool.call"]?.count).toBe(2);
    expect((res.body.byKind as Record<string, { count: number }>)["node.update"]?.count).toBe(1);
  });

  it("AC1: activeSessions lists unique session IDs from events", async () => {
    insertEvent(db, { kind: "tool.call", sessionId: "s1" });
    insertEvent(db, { kind: "tool.call", sessionId: "s2" });
    insertEvent(db, { kind: "tool.call", sessionId: "s1" });

    const res = await request(makeApp(db)).get("/api/observability/metrics?window=1h");
    const sessions = res.body.activeSessions as string[];
    expect(sessions).toContain("s1");
    expect(sessions).toContain("s2");
    expect(sessions.filter((s) => s === "s1")).toHaveLength(1);
  });

  it("AC1: returns 400 on invalid window param", async () => {
    const res = await request(makeApp(db)).get("/api/observability/metrics?window=bad");
    expect(res.status).toBe(400);
  });
});
