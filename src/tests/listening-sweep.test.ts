/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-23.T03 — listening-sweep tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { sweepStaleDecisions } from "../core/autonomy/listening-sweep.js";

describe("listening-sweep (E23.T03)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  function insert(id: string, success: number | null, createdAt: string): void {
    db.prepare(
      `INSERT INTO decisions (id, intent, options_json, chosen, reasoning, success, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, "test", "[]", "x", "r", success, createdAt);
  }

  it("returns closureRate=1 when there are no decisions", () => {
    const r = sweepStaleDecisions(db, Date.now());
    expect(r.totalChecked).toBe(0);
    expect(r.closureRate).toBe(1);
    expect(r.staleIds).toEqual([]);
  });

  it("returns closureRate=1 when all decisions have outcome registered", () => {
    insert("d1", 1, "2026-04-29T00:00:00Z");
    insert("d2", 0, "2026-04-29T00:00:00Z");
    const r = sweepStaleDecisions(db, Date.now());
    expect(r.closedCount).toBe(2);
    expect(r.staleCount).toBe(0);
    expect(r.closureRate).toBe(1);
  });

  it("flags decisions with null outcome older than staleAfterMs", () => {
    const now = new Date("2026-04-29T00:00:00Z").getTime();
    insert("old", null, "2026-04-01T00:00:00Z"); // ~28d old
    insert("recent", null, "2026-04-28T00:00:00Z"); // 1d old
    insert("closed", 1, "2026-04-01T00:00:00Z");
    const r = sweepStaleDecisions(db, now);
    expect(r.totalChecked).toBe(3);
    expect(r.staleIds).toEqual(["old"]);
    expect(r.closureRate).toBeCloseTo(1 / 3, 3);
  });

  it("respects custom staleAfterMs threshold", () => {
    const now = new Date("2026-04-29T00:00:00Z").getTime();
    insert("borderline", null, "2026-04-28T00:00:00Z"); // 1d old
    // With 2-day threshold → not stale
    let r = sweepStaleDecisions(db, now, 2 * 24 * 60 * 60 * 1000);
    expect(r.staleCount).toBe(0);
    // With 12-hour threshold → stale
    r = sweepStaleDecisions(db, now, 12 * 60 * 60 * 1000);
    expect(r.staleCount).toBe(1);
  });
});
