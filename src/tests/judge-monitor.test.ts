/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { JudgeMonitor } from "../core/swarm/judge-monitor.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 't', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

function insertSession(
  db: Database.Database,
  id: string,
  status: string,
  updatedAt: string,
): void {
  db.prepare(
    `INSERT INTO swarm_sessions (id, topology, consensus, status, max_agents, strategy, created_at, updated_at)
     VALUES (?, 'mesh', 'majority', ?, 5, 'balanced', ?, ?)`,
  ).run(id, status, updatedAt, updatedAt);
}

describe("JudgeMonitor.checkHealth", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it('returns "not_found" when session does not exist', () => {
    const monitor = new JudgeMonitor(db);
    const result = monitor.checkHealth("ghost");
    expect(result.status).toBe("not_found");
    expect(result.sessionId).toBe("ghost");
    expect(typeof result.checkedAt).toBe("number");
  });

  it('returns "inactive" for stopped sessions', () => {
    insertSession(db, "s1", "stopped", new Date().toISOString());
    const monitor = new JudgeMonitor(db);
    expect(monitor.checkHealth("s1").status).toBe("inactive");
  });

  it('returns "inactive" for pending sessions', () => {
    insertSession(db, "s2", "pending", new Date().toISOString());
    const monitor = new JudgeMonitor(db);
    expect(monitor.checkHealth("s2").status).toBe("inactive");
  });

  it('returns "healthy" for active sessions updated recently', () => {
    insertSession(db, "s3", "active", new Date().toISOString());
    const monitor = new JudgeMonitor(db, { stallThresholdMs: 60_000 });
    const result = monitor.checkHealth("s3");
    expect(result.status).toBe("healthy");
    expect(result.lastUpdatedAt).toBeDefined();
  });

  it('returns "stalled" when updated_at exceeds stallThresholdMs', () => {
    const oldTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    insertSession(db, "s4", "active", oldTs);
    const monitor = new JudgeMonitor(db, { stallThresholdMs: 60_000 });
    const result = monitor.checkHealth("s4");
    expect(result.status).toBe("stalled");
    expect(result.stallDurationMs).toBeGreaterThan(60_000);
    expect(result.message).toMatch(/has not updated/);
  });

  it("recordResult appends to internal report", () => {
    insertSession(db, "s5", "active", new Date().toISOString());
    const monitor = new JudgeMonitor(db);
    monitor.checkHealth("s5");
    monitor.checkHealth("s5");
    expect(monitor.getReport().checkedCount).toBe(2);
  });

  it("getReport returns shape with timestamp + results array copy", () => {
    const monitor = new JudgeMonitor(db);
    monitor.checkHealth("ghost");
    const report = monitor.getReport();
    expect(report).toHaveProperty("checkedCount");
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("results");
    expect(Array.isArray(report.results)).toBe(true);
    // Verify it's a copy
    report.results.push({ sessionId: "tampered", status: "healthy", checkedAt: 0 });
    expect(monitor.getReport().checkedCount).toBe(1);
  });

  it("default options: tickInterval 120s, stallThreshold 600s", () => {
    // We cannot directly read private fields, but we can verify behaviour:
    // a session updated 9 minutes ago should NOT be stalled at default 10-min threshold.
    const ts = new Date(Date.now() - 9 * 60 * 1000).toISOString();
    insertSession(db, "s6", "active", ts);
    const monitor = new JudgeMonitor(db);
    expect(monitor.checkHealth("s6").status).toBe("healthy");
  });
});
