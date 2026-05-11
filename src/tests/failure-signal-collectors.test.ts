/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: Hooks de coleta nas 5 fontes
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { FailureSignalCollector } from "../core/self-healing/failure-signal-collector.js";
import { collectToolInvocationError } from "../core/self-healing/collectors/tool-invocation-collector.js";
import { collectLifecycleGateBlock } from "../core/self-healing/collectors/lifecycle-gate-collector.js";
import { collectSqliteError } from "../core/self-healing/collectors/sqlite-collector.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FailureSignalRow {
  id: string;
  source: string;
  signalKind: string;
  context: string;
  severity: string;
  timestamp: string;
  rawError: string | null;
}

function migratedDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
  ).run("p1", "p1");
  return db;
}

function querySignals(db: Database.Database): FailureSignalRow[] {
  return db.prepare("SELECT * FROM failure_signals ORDER BY timestamp").all() as FailureSignalRow[];
}

// ---------------------------------------------------------------------------
// FailureSignalCollector core — queue + flush
// ---------------------------------------------------------------------------

describe("FailureSignalCollector — queue + flush", () => {
  let db: Database.Database;
  let collector: FailureSignalCollector;

  beforeEach(() => {
    db = migratedDb();
    collector = new FailureSignalCollector(db);
  });

  afterEach(() => {
    collector.shutdown();
  });

  it("record() enqueues without writing to DB immediately", () => {
    collector.record({
      source: "tool_invocation",
      signalKind: "tool_isError",
      context: { toolName: "finish_task" },
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    // Not flushed yet — DB should be empty
    expect(querySignals(db)).toHaveLength(0);
  });

  it("flush() writes all queued signals to failure_signals table", () => {
    collector.record({
      source: "tool_invocation",
      signalKind: "tool_isError",
      context: { toolName: "start_task" },
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    collector.record({
      source: "sqlite",
      signalKind: "SQLITE_BUSY",
      context: {},
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    collector.flush();
    const rows = querySignals(db);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("tool_invocation");
    expect(rows[1].source).toBe("sqlite");
  });

  it("flush() is idempotent — does not double-insert", () => {
    collector.record({
      source: "lifecycle_gate",
      signalKind: "gate_blocked",
      context: { phase: "IMPLEMENT", toolName: "node" },
      severity: "warn",
      timestamp: new Date().toISOString(),
    });
    collector.flush();
    collector.flush();
    expect(querySignals(db)).toHaveLength(1);
  });

  it("row has id, source, signalKind, context, severity, timestamp", () => {
    const ts = new Date().toISOString();
    collector.record({
      source: "dod_check",
      signalKind: "dod_fail",
      context: { nodeId: "node_abc" },
      severity: "warn",
      timestamp: ts,
      rawError: "missing AC",
    });
    collector.flush();
    const row = querySignals(db)[0];
    expect(row.id).toBeTruthy();
    expect(row.source).toBe("dod_check");
    expect(row.signalKind).toBe("dod_fail");
    expect(JSON.parse(row.context)).toMatchObject({ nodeId: "node_abc" });
    expect(row.severity).toBe("warn");
    expect(row.timestamp).toBe(ts);
    expect(row.rawError).toBe("missing AC");
  });
});

// ---------------------------------------------------------------------------
// AC4: record() does not block the main path
// ---------------------------------------------------------------------------

describe("FailureSignalCollector — AC4: non-blocking", () => {
  it("record() returns in < 5ms (does not synchronously write to DB)", () => {
    const db = migratedDb();
    const collector = new FailureSignalCollector(db);
    const signal = {
      source: "tool_invocation" as const,
      signalKind: "tool_isError",
      context: {},
      severity: "error" as const,
      timestamp: new Date().toISOString(),
    };
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) {
      collector.record(signal);
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(5);
    collector.shutdown();
  });

  it("start() sets up periodic flush without blocking", () => {
    const db = migratedDb();
    const collector = new FailureSignalCollector(db);
    // start() should not throw
    expect(() => collector.start(60_000)).not.toThrow();
    collector.shutdown();
  });
});

// ---------------------------------------------------------------------------
// AC1: tool_invocation collector
// ---------------------------------------------------------------------------

describe("collectToolInvocationError — AC1: isError:true → row in failure_signals", () => {
  let db: Database.Database;
  let collector: FailureSignalCollector;

  beforeEach(() => {
    db = migratedDb();
    collector = new FailureSignalCollector(db);
  });

  afterEach(() => { collector.shutdown(); });

  it("records signal when result.isError is true", () => {
    collectToolInvocationError(
      { content: [{ type: "text", text: "err" }], isError: true },
      "finish_task",
      collector,
    );
    collector.flush();
    const rows = querySignals(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("tool_invocation");
    expect(rows[0].severity).toBe("error");
    const ctx = JSON.parse(rows[0].context) as { toolName?: string };
    expect(ctx.toolName).toBe("finish_task");
  });

  it("does NOT record when result.isError is false", () => {
    collectToolInvocationError(
      { content: [{ type: "text", text: "ok" }], isError: false },
      "start_task",
      collector,
    );
    collector.flush();
    expect(querySignals(db)).toHaveLength(0);
  });

  it("does NOT record when result.isError is undefined", () => {
    collectToolInvocationError(
      { content: [{ type: "text", text: "ok" }] },
      "list",
      collector,
    );
    collector.flush();
    expect(querySignals(db)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC2: lifecycle_gate collector
// ---------------------------------------------------------------------------

describe("collectLifecycleGateBlock — AC2: row includes phase + toolName", () => {
  let db: Database.Database;
  let collector: FailureSignalCollector;

  beforeEach(() => {
    db = migratedDb();
    collector = new FailureSignalCollector(db);
  });

  afterEach(() => { collector.shutdown(); });

  it("records signal with phase and toolName in context", () => {
    collectLifecycleGateBlock("node", "IMPLEMENT", collector);
    collector.flush();
    const rows = querySignals(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("lifecycle_gate");
    const ctx = JSON.parse(rows[0].context) as { phase?: string; toolName?: string };
    expect(ctx.phase).toBe("IMPLEMENT");
    expect(ctx.toolName).toBe("node");
  });

  it("severity is warn (gate blocked, not a crash)", () => {
    collectLifecycleGateBlock("analyze", "REVIEW", collector);
    collector.flush();
    expect(querySignals(db)[0].severity).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// AC3: sqlite collector
// ---------------------------------------------------------------------------

describe("collectSqliteError — AC3: SQLITE_BUSY → row with severity error", () => {
  let db: Database.Database;
  let collector: FailureSignalCollector;

  beforeEach(() => {
    db = migratedDb();
    collector = new FailureSignalCollector(db);
  });

  afterEach(() => { collector.shutdown(); });

  it("records SQLITE_BUSY with severity error", () => {
    const err = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
    collectSqliteError(err, collector);
    collector.flush();
    const rows = querySignals(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("sqlite");
    expect(rows[0].severity).toBe("error");
    expect(rows[0].signalKind).toBe("SQLITE_BUSY");
  });

  it("records SQLITE_LOCKED with severity error", () => {
    const err = Object.assign(new Error("database is locked"), { code: "SQLITE_LOCKED" });
    collectSqliteError(err, collector);
    collector.flush();
    expect(querySignals(db)[0].signalKind).toBe("SQLITE_LOCKED");
    expect(querySignals(db)[0].severity).toBe("error");
  });

  it("records rawError message", () => {
    const err = Object.assign(new Error("db locked by peer"), { code: "SQLITE_BUSY" });
    collectSqliteError(err, collector);
    collector.flush();
    expect(querySignals(db)[0].rawError).toBe("db locked by peer");
  });

  it("records generic DB errors with severity warn", () => {
    const err = new Error("unexpected sqlite failure");
    collectSqliteError(err, collector);
    collector.flush();
    const rows = querySignals(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("warn");
  });
});
