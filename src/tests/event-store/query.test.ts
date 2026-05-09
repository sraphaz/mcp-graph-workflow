/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.3 — Query API: getEventsBySession, getMetrics, getCausalityChain
 *
 * AC1: GIVEN 50 eventos com mesmo sessionId WHEN getEventsBySession THEN retorna em ordem
 * AC2: GIVEN getMetrics(kind:"tool.invoked", window:24h) THEN p50/p95 corretos vs raw query
 * AC3: GIVEN getCausalityChain de evento com 5 ancestrais THEN retorna 5 + raiz
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { getEventsBySession, getEventsBySubject, getMetrics, getCausalityChain } from "../../core/event-store/query.js";
import { generateId } from "../../core/utils/id.js";

let db: Database.Database;

function insertEvent(overrides: {
  id?: string;
  kind?: string;
  subjectRef_kind?: string;
  subjectRef_id?: string;
  sessionId?: string | null;
  timestamp?: string;
  durationMs?: number | null;
  parentEventId?: string | null;
}): string {
  const id = overrides.id ?? generateId("evt");
  db.prepare(
    `INSERT INTO events (id, kind, subjectRef_kind, subjectRef_id, sessionId, timestamp, durationMs, parentEventId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides.kind ?? "test.event",
    overrides.subjectRef_kind ?? "task",
    overrides.subjectRef_id ?? "node_abc",
    overrides.sessionId ?? null,
    overrides.timestamp ?? new Date().toISOString(),
    overrides.durationMs ?? null,
    overrides.parentEventId ?? null
  );
  return id;
}

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// AC1: getEventsBySession returns 50 events in timestamp order
// ---------------------------------------------------------------------------

describe("getEventsBySession — AC1: 50 events in order", () => {
  it("should return all 50 events for sessionId in ascending order", () => {
    const sessionId = "sess_test";
    for (let i = 0; i < 50; i++) {
      insertEvent({ sessionId, timestamp: new Date(1_000_000 + i * 1000).toISOString() });
    }
    insertEvent({ sessionId: "other_sess" });

    const results = getEventsBySession(db, sessionId, 100);
    expect(results).toHaveLength(50);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.timestamp >= results[i - 1]!.timestamp).toBe(true);
    }
  });

  it("should respect the limit parameter", () => {
    const sessionId = "sess_limit";
    for (let i = 0; i < 20; i++) {
      insertEvent({ sessionId });
    }
    const results = getEventsBySession(db, sessionId, 10);
    expect(results).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// AC2: getMetrics p50/p95 correct vs raw query
// ---------------------------------------------------------------------------

describe("getMetrics — AC2: p50/p95 correct for 24h window", () => {
  it("should return count and correct p50/p95 for tool.invoked events", () => {
    const now = Date.now();
    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (const d of durations) {
      insertEvent({
        kind: "tool.invoked",
        timestamp: new Date(now - 1000).toISOString(),
        durationMs: d,
      });
    }
    insertEvent({ kind: "other.event", timestamp: new Date(now - 1000).toISOString(), durationMs: 999 });

    const metrics = getMetrics(db, "tool.invoked", 24 * 60 * 60 * 1000);
    expect(metrics.count).toBe(10);
    expect(metrics.p50).toBe(50);
    expect(metrics.p95).toBe(95);
  });

  it("should exclude events outside the time window", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    insertEvent({ kind: "tool.invoked", timestamp: old, durationMs: 50 });
    const metrics = getMetrics(db, "tool.invoked", 24 * 60 * 60 * 1000);
    expect(metrics.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC3: getCausalityChain returns 5 ancestors + root
// ---------------------------------------------------------------------------

describe("getCausalityChain — AC3: 5 ancestors + root", () => {
  it("should traverse 5 ancestor links and return root", () => {
    const ids: string[] = [];
    ids.push(insertEvent({ kind: "root.event", parentEventId: null }));
    for (let i = 1; i <= 5; i++) {
      ids.push(insertEvent({ kind: `level.${i}`, parentEventId: ids[i - 1]! }));
    }

    const leafId = ids[ids.length - 1]!;
    const chain = getCausalityChain(db, leafId);
    expect(chain).toHaveLength(6);
    const kinds = chain.map((e) => e.kind);
    expect(kinds).toContain("root.event");
  });

  it("should return single event when no parent", () => {
    const id = insertEvent({ parentEventId: null });
    const chain = getCausalityChain(db, id);
    expect(chain).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getEventsBySubject
// ---------------------------------------------------------------------------

describe("getEventsBySubject", () => {
  it("should return all events for a given subject", () => {
    insertEvent({ subjectRef_kind: "task", subjectRef_id: "node_1" });
    insertEvent({ subjectRef_kind: "task", subjectRef_id: "node_1" });
    insertEvent({ subjectRef_kind: "task", subjectRef_id: "node_2" });

    const results = getEventsBySubject(db, "task", "node_1");
    expect(results).toHaveLength(2);
  });
});
