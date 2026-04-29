/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { SwarmCoordinator } from "../core/swarm/swarm-coordinator.js";
import type { SwarmConfigInput } from "../core/swarm/swarm-types.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

const baseConfig: SwarmConfigInput = {
  topology: "hierarchical",
  consensus: "raft",
  maxAgents: 4,
  strategy: "specialized",
};

describe("SwarmCoordinator.init", () => {
  let db: Database.Database;
  let coordinator: SwarmCoordinator;

  beforeEach(() => {
    db = createDb();
    coordinator = new SwarmCoordinator(db);
  });

  it("returns a session with a generated id", () => {
    const session = coordinator.init(baseConfig);
    expect(session.id).toBeTruthy();
    expect(typeof session.id).toBe("string");
  });

  it("persists session in swarm_sessions table", () => {
    const session = coordinator.init(baseConfig);
    const row = db.prepare("SELECT * FROM swarm_sessions WHERE id = ?").get(session.id) as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect(row?.topology).toBe("hierarchical");
    expect(row?.consensus).toBe("raft");
    expect(row?.max_agents).toBe(4);
  });

  it("session starts with status 'pending'", () => {
    const session = coordinator.init(baseConfig);
    expect(session.status).toBe("pending");
  });

  it("start transitions session status to 'active'", () => {
    const session = coordinator.init(baseConfig);
    coordinator.start(session.id);
    const updated = coordinator.status(session.id);
    expect(updated.status).toBe("active");
  });
});

describe("SwarmCoordinator.stop", () => {
  let db: Database.Database;
  let coordinator: SwarmCoordinator;

  beforeEach(() => {
    db = createDb();
    coordinator = new SwarmCoordinator(db);
  });

  it("stop transitions session status to 'stopped'", () => {
    const session = coordinator.init(baseConfig);
    coordinator.start(session.id);
    coordinator.stop(session.id);
    const updated = coordinator.status(session.id);
    expect(updated.status).toBe("stopped");
  });

  it("stop clears swarm_agents rows for the session", () => {
    const session = coordinator.init(baseConfig);
    coordinator.start(session.id);
    db.prepare(
      "INSERT INTO swarm_agents (id, session_id, role, status, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("agent-1", session.id, "worker", "idle", new Date().toISOString());
    coordinator.stop(session.id);
    const agents = db.prepare("SELECT * FROM swarm_agents WHERE session_id = ?").all(session.id);
    expect(agents).toHaveLength(0);
  });

  it("stop on unknown session throws", () => {
    expect(() => coordinator.stop("nonexistent-id")).toThrow();
  });
});

describe("SwarmCoordinator.scale", () => {
  let db: Database.Database;
  let coordinator: SwarmCoordinator;

  beforeEach(() => {
    db = createDb();
    coordinator = new SwarmCoordinator(db);
  });

  it("scale updates max_agents", () => {
    const session = coordinator.init(baseConfig);
    coordinator.scale(session.id, 8);
    const updated = coordinator.status(session.id);
    expect(updated.maxAgents).toBe(8);
  });

  it("scale enforces maxAgents ceiling of 32", () => {
    const session = coordinator.init(baseConfig);
    expect(() => coordinator.scale(session.id, 33)).toThrow(/ceiling|maxAgents|32/i);
  });

  it("scale rejects zero or negative values", () => {
    const session = coordinator.init(baseConfig);
    expect(() => coordinator.scale(session.id, 0)).toThrow();
    expect(() => coordinator.scale(session.id, -1)).toThrow();
  });
});

describe("SwarmCoordinator.status", () => {
  let db: Database.Database;
  let coordinator: SwarmCoordinator;

  beforeEach(() => {
    db = createDb();
    coordinator = new SwarmCoordinator(db);
  });

  it("status returns session info with topology and consensus", () => {
    const session = coordinator.init(baseConfig);
    const info = coordinator.status(session.id);
    expect(info.topology).toBe("hierarchical");
    expect(info.consensus).toBe("raft");
  });

  it("status throws for unknown session id", () => {
    expect(() => coordinator.status("bogus")).toThrow();
  });
});
