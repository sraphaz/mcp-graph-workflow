/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B1 — error_patterns persistence + UPSERT.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { recordError, hashError, getErrorPattern } from "../core/utils/error-recorder.js";

describe("error-recorder (E22.B1)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("migration v77 creates error_patterns with required columns", () => {
    const cols = db
      .prepare("PRAGMA table_info(error_patterns)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const col of ["id", "error_hash", "category", "message", "count", "first_seen", "last_seen"]) {
      expect(names.has(col), `missing error_patterns.${col}`).toBe(true);
    }
  });

  it("migration v77 registered in _migrations", () => {
    const m = db
      .prepare("SELECT version FROM _migrations WHERE version = 77")
      .get() as { version: number } | undefined;
    expect(m?.version).toBe(77);
  });

  it("hashError is stable for same message", () => {
    expect(hashError("ECONNRESET on port 8080")).toBe(hashError("ECONNRESET on port 8080"));
  });

  it("hashError normalizes transient digits and hex", () => {
    const a = hashError("ECONNRESET on port 8080");
    const b = hashError("ECONNRESET on port 9090");
    expect(a).toBe(b);
  });

  it("recordError INSERT on first occurrence with count=1", () => {
    const rec = recordError(db, new Error("429 Too Many Requests"));
    expect(rec.count).toBe(1);
    expect(rec.category).toBe("rate_limit");
    expect(rec.firstSeen).toBe(rec.lastSeen);
  });

  it("recordError UPSERT increments count on duplicate hash", () => {
    recordError(db, new Error("ECONNRESET"));
    recordError(db, new Error("ECONNRESET"));
    const rec = recordError(db, new Error("ECONNRESET"));
    expect(rec.count).toBe(3);
    expect(rec.category).toBe("network");
  });

  it("recordError preserves first_seen across UPSERTs", () => {
    const r1 = recordError(db, new Error("SQLITE_BUSY"));
    const r2 = recordError(db, new Error("SQLITE_BUSY"));
    expect(r2.firstSeen).toBe(r1.firstSeen);
    expect(r2.lastSeen >= r1.lastSeen).toBe(true);
  });

  it("recordError tracks distinct errors separately", () => {
    recordError(db, new Error("429 Too Many Requests"));
    recordError(db, new Error("ECONNRESET"));
    const rows = db
      .prepare("SELECT COUNT(*) AS n FROM error_patterns")
      .get() as { n: number };
    expect(rows.n).toBe(2);
  });

  it("getErrorPattern returns undefined for unknown hash", () => {
    expect(getErrorPattern(db, "nonexistent")).toBeUndefined();
  });

  it("getErrorPattern returns recorded pattern", () => {
    const rec = recordError(db, new Error("timeout exceeded"));
    const fetched = getErrorPattern(db, rec.errorHash);
    expect(fetched?.category).toBe("timeout");
    expect(fetched?.count).toBe(1);
  });

  it("truncates very long messages to 500 chars", () => {
    const long = "x".repeat(2000);
    recordError(db, new Error(long));
    const row = db
      .prepare("SELECT message FROM error_patterns")
      .get() as { message: string };
    expect(row.message.length).toBeLessThanOrEqual(500);
  });
});
