/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 1 completion — JudgeMonitor: stall detection + doom loop detection
 * Inspired by hive-main Judge Pipeline (2-min ticks).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { SwarmCoordinator } from "../core/swarm/swarm-coordinator.js";
import { JudgeMonitor } from "../core/swarm/judge-monitor.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
  ).run("proj", "proj");
  return db;
}

describe("JudgeMonitor — health monitoring for swarm sessions", () => {
  let db: Database.Database;
  let coordinator: SwarmCoordinator;
  let judge: JudgeMonitor;

  beforeEach(() => {
    db = makeDb();
    coordinator = new SwarmCoordinator(db);
    judge = new JudgeMonitor(db, { tickIntervalMs: 100, stallThresholdMs: 200 });
  });

  afterEach(() => {
    judge.stop();
  });

  it("detects healthy session (no stall) as 'healthy'", () => {
    const session = coordinator.init({ topology: "ring", consensus: "majority", maxAgents: 2, strategy: "specialized" });
    coordinator.start(session.id);
    const health = judge.checkHealth(session.id);
    expect(health.status).toBe("healthy");
  });

  it("detects stopped session as 'inactive'", () => {
    const session = coordinator.init({ topology: "star", consensus: "raft", maxAgents: 3, strategy: "specialized" });
    coordinator.start(session.id);
    coordinator.stop(session.id);
    const health = judge.checkHealth(session.id);
    expect(health.status).toBe("inactive");
  });

  it("detects unknown session as 'not_found'", () => {
    const health = judge.checkHealth("nonexistent-id");
    expect(health.status).toBe("not_found");
  });

  it("checkHealth returns sessionId in result", () => {
    const session = coordinator.init({ topology: "mesh", consensus: "majority", maxAgents: 2, strategy: "specialized" });
    const health = judge.checkHealth(session.id);
    expect(health.sessionId).toBe(session.id);
  });

  it("getReport returns summary with all checked sessions", () => {
    const s1 = coordinator.init({ topology: "ring", consensus: "majority", maxAgents: 2, strategy: "specialized" });
    const s2 = coordinator.init({ topology: "star", consensus: "raft", maxAgents: 3, strategy: "specialized" });
    coordinator.start(s1.id);
    judge.checkHealth(s1.id);
    judge.checkHealth(s2.id);
    const report = judge.getReport();
    expect(report.checkedCount).toBeGreaterThanOrEqual(2);
    expect(report.timestamp).toBeGreaterThan(0);
  });
});
