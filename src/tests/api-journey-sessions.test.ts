/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-browser-harness-mcp-rewrite — Task 4.1: GET /api/journey/sessions/:sessionId
 *
 * AC1: GIVEN valid sessionId WHEN GET THEN returns ordered events list
 * AC2: GIVEN invalid sessionId WHEN GET THEN 404 structured error
 * AC3: GIVEN session with 1000 events WHEN GET THEN cursor-based pagination
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

function getDb(ctx: TestContext): Database {
  return (ctx.store as unknown as { getDb(): Database }).getDb();
}

function insertSession(db: Database, id: string, status = "ready"): void {
  db.prepare(
    `INSERT INTO bh_sessions (id, cdp_endpoint, pid, status, started_at, closed_at)
     VALUES (?, ?, NULL, ?, ?, NULL)`,
  ).run(id, "ws://127.0.0.1:9222", status, Date.now());
}

function insertAuditEvent(
  db: Database,
  id: string,
  sessionId: string,
  action: string,
  at: number,
): void {
  db.prepare(
    `INSERT INTO bh_audit (id, session_id, action, payload, result, at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
  ).run(id, sessionId, action, JSON.stringify({ step: action }), at);
}

describe("API GET /api/v1/journey/sessions/:sessionId", () => {
  let ctx: TestContext;
  let db: Database;

  beforeEach(() => {
    ctx = createTestApp();
    db = getDb(ctx);
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── AC2: invalid sessionId → 404 ─────────────────────────────────────────

  it("AC2: unknown sessionId returns 404", async () => {
    const res = await request(ctx.app).get("/api/v1/journey/sessions/non-existent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  // ── AC1: valid sessionId → ordered events list ────────────────────────────

  it("AC1: valid sessionId returns 200 with session and events", async () => {
    insertSession(db, "sess-1");
    insertAuditEvent(db, "evt-1", "sess-1", "navigate", 1000);
    insertAuditEvent(db, "evt-2", "sess-1", "click", 2000);

    const res = await request(ctx.app).get("/api/v1/journey/sessions/sess-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("session");
    expect(res.body).toHaveProperty("events");
    expect(res.body.session.id).toBe("sess-1");
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it("AC1: events are ordered by at ascending (causal order)", async () => {
    insertSession(db, "sess-2");
    insertAuditEvent(db, "e-late", "sess-2", "type", 3000);
    insertAuditEvent(db, "e-early", "sess-2", "navigate", 1000);
    insertAuditEvent(db, "e-mid", "sess-2", "click", 2000);

    const res = await request(ctx.app).get("/api/v1/journey/sessions/sess-2");
    expect(res.status).toBe(200);
    const ats = (res.body.events as Array<{ at: number }>).map((e) => e.at);
    expect(ats).toEqual([1000, 2000, 3000]);
  });

  it("AC1: session with no events returns empty array", async () => {
    insertSession(db, "sess-empty");
    const res = await request(ctx.app).get("/api/v1/journey/sessions/sess-empty");
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("AC1: response includes session metadata", async () => {
    insertSession(db, "sess-meta", "closed");
    const res = await request(ctx.app).get("/api/v1/journey/sessions/sess-meta");
    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ id: "sess-meta", status: "closed" });
    expect(typeof res.body.session.startedAt).toBe("number");
  });

  // ── AC3: cursor-based pagination ──────────────────────────────────────────

  it("AC3: limit param restricts events returned", async () => {
    insertSession(db, "sess-page");
    for (let i = 0; i < 10; i++) {
      insertAuditEvent(db, `ep-${i}`, "sess-page", "step", i * 100);
    }
    const res = await request(ctx.app).get(
      "/api/v1/journey/sessions/sess-page?limit=3",
    );
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(3);
  });

  it("AC3: nextCursor is non-null when more events exist", async () => {
    insertSession(db, "sess-more");
    for (let i = 0; i < 5; i++) {
      insertAuditEvent(db, `em-${i}`, "sess-more", "step", i * 100);
    }
    const res = await request(ctx.app).get(
      "/api/v1/journey/sessions/sess-more?limit=2",
    );
    expect(res.status).toBe(200);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it("AC3: nextCursor is null on last page", async () => {
    insertSession(db, "sess-last");
    for (let i = 0; i < 3; i++) {
      insertAuditEvent(db, `el-${i}`, "sess-last", "step", i * 100);
    }
    const res = await request(ctx.app).get(
      "/api/v1/journey/sessions/sess-last?limit=10",
    );
    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
  });

  it("AC3: cursor fetches the next page", async () => {
    insertSession(db, "sess-cur");
    for (let i = 0; i < 6; i++) {
      insertAuditEvent(db, `ec-${i}`, "sess-cur", "step", i * 100);
    }
    const page1 = await request(ctx.app).get(
      "/api/v1/journey/sessions/sess-cur?limit=3",
    );
    expect(page1.status).toBe(200);
    const cursor = page1.body.nextCursor as string;
    expect(cursor).not.toBeNull();

    const page2 = await request(ctx.app).get(
      `/api/v1/journey/sessions/sess-cur?limit=3&cursor=${cursor}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.body.events).toHaveLength(3);
    expect(page2.body.nextCursor).toBeNull();

    // No overlap between pages
    const ids1 = (page1.body.events as Array<{ id: string }>).map((e) => e.id);
    const ids2 = (page2.body.events as Array<{ id: string }>).map((e) => e.id);
    const union = new Set([...ids1, ...ids2]);
    expect(union.size).toBe(6);
  });
});
