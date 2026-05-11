/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §node_3ac439cce368 — Task 1.2: GET /api/agent/trail?session=...&limit=N
 *
 * AC1: GIVEN sessionId WHEN GET limit=20 THEN returns 20 most recent events in order
 * AC2: GIVEN no active session WHEN GET THEN returns explicit empty list
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { createAgentTrailRouter } from "../api/routes/agent-trail.js";
import type { StoreRef } from "../core/store/store-manager.js";
import { generateId } from "../core/utils/id.js";

let db: Database.Database;

function makeStoreRef(): StoreRef {
  return { current: { getDb: () => db } } as unknown as StoreRef;
}

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/agent", createAgentTrailRouter(makeStoreRef()));
  return app;
}

function insertEvent(overrides: {
  sessionId?: string | null;
  kind?: string;
  timestamp?: string;
}): void {
  db.prepare(
    `INSERT INTO events (id, kind, subjectRef_kind, subjectRef_id, sessionId, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    generateId("evt"),
    overrides.kind ?? "test.event",
    "task",
    "node_test",
    overrides.sessionId ?? null,
    overrides.timestamp ?? new Date().toISOString()
  );
}

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

// ── AC1: returns events in order ──────────────────────────────────────────────

describe("AC1: GET /agent/trail returns events in ascending timestamp order", () => {
  it("returns up to limit=20 events for a given session", async () => {
    const sessionId = "sess_trail_01";
    for (let i = 0; i < 25; i++) {
      insertEvent({
        sessionId,
        timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      });
    }

    const res = await request(makeApp())
      .get(`/agent/trail?session=${sessionId}&limit=20`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events).toHaveLength(20);
  });

  it("events are ordered by timestamp ascending", async () => {
    const sessionId = "sess_order";
    for (let i = 0; i < 5; i++) {
      insertEvent({
        sessionId,
        timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      });
    }

    const res = await request(makeApp())
      .get(`/agent/trail?session=${sessionId}&limit=10`);

    expect(res.status).toBe(200);
    const events = res.body.events as Array<{ timestamp: string }>;
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.timestamp >= events[i - 1]!.timestamp).toBe(true);
    }
  });

  it("only returns events for the requested session, not other sessions", async () => {
    insertEvent({ sessionId: "sess_A" });
    insertEvent({ sessionId: "sess_A" });
    insertEvent({ sessionId: "sess_B" });

    const res = await request(makeApp())
      .get("/agent/trail?session=sess_A&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
  });

  it("uses default limit of 20 when limit param is omitted", async () => {
    const sessionId = "sess_default";
    for (let i = 0; i < 30; i++) {
      insertEvent({ sessionId, timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString() });
    }

    const res = await request(makeApp())
      .get(`/agent/trail?session=${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(20);
  });
});

// ── AC2: empty list when no events for session ────────────────────────────────

describe("AC2: GET /agent/trail returns explicit empty list for unknown session", () => {
  it("returns { events: [] } when sessionId has no events", async () => {
    const res = await request(makeApp())
      .get("/agent/trail?session=unknown_session&limit=20");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(res.body.events).toEqual([]);
  });

  it("returns 400 when session param is missing", async () => {
    const res = await request(makeApp()).get("/agent/trail");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
