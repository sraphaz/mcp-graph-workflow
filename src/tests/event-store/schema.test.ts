/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Schema Zod + migration para event-store
 *
 * AC1: GIVEN evento WHEN inserido THEN row persistido com ID gerado
 * AC2: GIVEN query por (subjectRef.kind, subjectRef.id) WHEN executada THEN usa índice (EXPLAIN)
 * AC3: GIVEN evento sem campo opcional WHEN validado por Zod THEN aceita
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { EventRecordSchema } from "../../core/event-store/schema.js";
import { generateId } from "../../core/utils/id.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// AC1: insert event → row persisted with generated ID
// ---------------------------------------------------------------------------

describe("event-store migration — AC1: row persisted with generated ID", () => {
  it("should persist an inserted event and retrieve it by ID", () => {
    const id = generateId("evt");
    db.prepare(
      `INSERT INTO events (id, kind, subjectRef_kind, subjectRef_id, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, "task.started", "task", "node_abc123", new Date().toISOString());

    const row = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as { id: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.id).toBe(id);
    expect(row?.id.length).toBeGreaterThan(0);
  });

  it("should reject duplicate IDs (PRIMARY KEY constraint)", () => {
    const id = generateId("evt");
    const insert = db.prepare(
      `INSERT INTO events (id, kind, subjectRef_kind, subjectRef_id, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    );
    insert.run(id, "task.started", "task", "node_abc", new Date().toISOString());
    expect(() => insert.run(id, "task.done", "task", "node_abc", new Date().toISOString())).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC2: query by (subjectRef_kind, subjectRef_id) uses index
// ---------------------------------------------------------------------------

describe("event-store migration — AC2: index on (subjectRef_kind, subjectRef_id)", () => {
  it("should use an index for subjectRef queries (EXPLAIN QUERY PLAN)", () => {
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT * FROM events
         WHERE subjectRef_kind = ? AND subjectRef_id = ?`
      )
      .all("task", "node_abc") as Array<{ detail: string }>;

    const detail = plan.map((r) => r.detail).join(" ");
    expect(detail).toMatch(/USING INDEX|USING COVERING INDEX/i);
  });
});

// ---------------------------------------------------------------------------
// AC3: Zod schema accepts event without optional fields
// ---------------------------------------------------------------------------

describe("EventRecordSchema — AC3: optional fields not required", () => {
  it("should accept event with only required fields", () => {
    const result = EventRecordSchema.safeParse({
      id: generateId("evt"),
      kind: "task.started",
      subjectRef: { kind: "task", id: "node_abc" },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("should accept event with all optional fields populated", () => {
    const result = EventRecordSchema.safeParse({
      id: generateId("evt"),
      kind: "task.started",
      subjectRef: { kind: "task", id: "node_abc" },
      payload: { extra: "data" },
      projectId: "proj_1",
      sessionId: "sess_1",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("should reject event without required kind field", () => {
    const result = EventRecordSchema.safeParse({
      id: generateId("evt"),
      subjectRef: { kind: "task", id: "node_abc" },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
