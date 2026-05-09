/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Migration tabela `failure_signals`
 *
 * AC1: GIVEN migration aplicada WHEN insert THEN rows persistem
 * AC2: GIVEN query por signalKind WHEN SELECT THEN usa índice (EXPLAIN)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// AC1: rows persist after insert
// ---------------------------------------------------------------------------

describe("failure_signals migration — AC1: rows persist", () => {
  it("table exists after migration", () => {
    const row = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='failure_signals'")
      .get();
    expect(row).toBeDefined();
  });

  it("insert a row and it persists", () => {
    db.prepare(`
      INSERT INTO failure_signals (source, signalKind, context, severity, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "tool_invocation",
      "tool_isError",
      JSON.stringify({ toolName: "finish_task" }),
      "error",
      new Date().toISOString(),
    );
    const count = (db.prepare("SELECT COUNT(*) AS n FROM failure_signals").get() as { n: number }).n;
    expect(count).toBe(1);
  });

  it("rawError column accepts null", () => {
    db.prepare(`
      INSERT INTO failure_signals (source, signalKind, context, severity, timestamp, rawError)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("sqlite", "sqlite_busy", "{}", "warn", new Date().toISOString(), null);
    const row = db.prepare("SELECT rawError FROM failure_signals").get() as { rawError: null };
    expect(row.rawError).toBeNull();
  });

  it("rawError column stores a string value", () => {
    db.prepare(`
      INSERT INTO failure_signals (source, signalKind, context, severity, timestamp, rawError)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("mcp_server", "connection_refused", "{}", "critical", new Date().toISOString(), "ECONNREFUSED");
    const row = db.prepare("SELECT rawError FROM failure_signals").get() as { rawError: string };
    expect(row.rawError).toBe("ECONNREFUSED");
  });

  it("multiple rows persist independently", () => {
    const stmt = db.prepare(`
      INSERT INTO failure_signals (source, signalKind, context, severity, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run("tool_invocation", "tool_isError", "{}", "error", "2026-05-09T10:00:00Z");
    stmt.run("lifecycle_gate", "lifecycle_gate_blocked", "{}", "warn", "2026-05-09T11:00:00Z");
    stmt.run("dod_check", "has_testable_ac_failed", "{}", "warn", "2026-05-09T12:00:00Z");
    const count = (db.prepare("SELECT COUNT(*) AS n FROM failure_signals").get() as { n: number }).n;
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC2: index used on signalKind query (EXPLAIN QUERY PLAN)
// ---------------------------------------------------------------------------

describe("failure_signals migration — AC2: index usage", () => {
  it("EXPLAIN QUERY PLAN uses index on signalKind", () => {
    const plan = db
      .prepare("EXPLAIN QUERY PLAN SELECT * FROM failure_signals WHERE signalKind = ?")
      .all("tool_isError") as Array<{ detail: string }>;
    const detail = plan.map((r) => r.detail ?? "").join(" ").toLowerCase();
    expect(detail).toMatch(/index/);
  });

  it("EXPLAIN QUERY PLAN uses index on source", () => {
    const plan = db
      .prepare("EXPLAIN QUERY PLAN SELECT * FROM failure_signals WHERE source = ?")
      .all("sqlite") as Array<{ detail: string }>;
    const detail = plan.map((r) => r.detail ?? "").join(" ").toLowerCase();
    expect(detail).toMatch(/index/);
  });

  it("EXPLAIN QUERY PLAN uses index on timestamp", () => {
    const plan = db
      .prepare("EXPLAIN QUERY PLAN SELECT * FROM failure_signals WHERE timestamp > ?")
      .all("2026-01-01") as Array<{ detail: string }>;
    const detail = plan.map((r) => r.detail ?? "").join(" ").toLowerCase();
    expect(detail).toMatch(/index/);
  });
});
