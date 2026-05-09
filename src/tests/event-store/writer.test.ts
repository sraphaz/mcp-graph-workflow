/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — EventWriter: fila + flush batch
 *
 * AC1: GIVEN 1000 emit em loop WHEN flush roda THEN todos persistidos em ordem
 * AC2: GIVEN crash durante flush WHEN reinicia THEN buffer perdido (best-effort)
 * AC3: GIVEN benchmark WHEN testado THEN overhead < 100µs p99 por emit
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { EventWriter } from "../../core/event-store/writer.js";

let db: Database.Database;
let writer: EventWriter;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  writer = new EventWriter(db);
});

afterEach(async () => {
  await writer.close();
  db.close();
});

// ---------------------------------------------------------------------------
// AC1: 1000 emits → all persisted in order after flush
// ---------------------------------------------------------------------------

describe("EventWriter — AC1: 1000 emits persisted in order", () => {
  it("should persist all 1000 events after forceFlush", async () => {
    for (let i = 0; i < 1000; i++) {
      writer.emit({
        kind: "test.event",
        subjectRef: { kind: "task", id: `node_${i}` },
        timestamp: new Date(1_000_000 + i).toISOString(),
        sessionId: "sess_1",
      });
    }

    await writer.forceFlush();

    const rows = db.prepare("SELECT * FROM events ORDER BY timestamp ASC").all() as Array<{ timestamp: string }>;
    expect(rows).toHaveLength(1000);

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.timestamp >= rows[i - 1]!.timestamp).toBe(true);
    }
  });

  it("should flush automatically when buffer reaches 100 events", async () => {
    for (let i = 0; i < 100; i++) {
      writer.emit({
        kind: "test.event",
        subjectRef: { kind: "task", id: `node_${i}` },
        timestamp: new Date().toISOString(),
      });
    }

    await new Promise((r) => setTimeout(r, 50));

    const count = (db.prepare("SELECT COUNT(*) as n FROM events").get() as { n: number }).n;
    expect(count).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// AC2: buffer is in-memory (best-effort, not durable)
// ---------------------------------------------------------------------------

describe("EventWriter — AC2: buffer is in-memory (best-effort)", () => {
  it("should not persist events that have not been flushed yet", () => {
    writer.emit({
      kind: "test.event",
      subjectRef: { kind: "task", id: "node_unflushed" },
      timestamp: new Date().toISOString(),
    });

    const count = (db.prepare("SELECT COUNT(*) as n FROM events").get() as { n: number }).n;
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC3: emit overhead < 100µs p99
// ---------------------------------------------------------------------------

describe("EventWriter — AC3: emit overhead < 100µs p99", () => {
  it("should emit 1000 events with p99 < 100µs each", () => {
    const times: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const t0 = performance.now();
      writer.emit({
        kind: "bench.event",
        subjectRef: { kind: "task", id: `node_${i}` },
        timestamp: new Date().toISOString(),
      });
      times.push((performance.now() - t0) * 1000);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(100);
  });
});
