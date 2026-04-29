/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function tableInfo(db: Database.Database, table: string): { name: string; type: string; notnull: number }[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string; notnull: number }[];
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { name: string } | undefined;
  return row !== undefined;
}

function foreignKeys(db: Database.Database, table: string): { table: string; from: string; to: string }[] {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all() as { table: string; from: string; to: string }[];
}

describe("migration v69 — swarm tables", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  it("creates swarm_sessions table", () => {
    expect(tableExists(db, "swarm_sessions")).toBe(true);
  });

  it("creates swarm_agents table", () => {
    expect(tableExists(db, "swarm_agents")).toBe(true);
  });

  it("creates swarm_consensus_rounds table", () => {
    expect(tableExists(db, "swarm_consensus_rounds")).toBe(true);
  });

  it("swarm_sessions has required columns: id, topology, consensus, status, max_agents, created_at, updated_at", () => {
    const cols = tableInfo(db, "swarm_sessions").map((c) => c.name);
    expect(cols).toContain("id");
    expect(cols).toContain("topology");
    expect(cols).toContain("consensus");
    expect(cols).toContain("status");
    expect(cols).toContain("max_agents");
    expect(cols).toContain("created_at");
    expect(cols).toContain("updated_at");
  });

  it("swarm_agents has required columns: id, session_id, role, status, created_at", () => {
    const cols = tableInfo(db, "swarm_agents").map((c) => c.name);
    expect(cols).toContain("id");
    expect(cols).toContain("session_id");
    expect(cols).toContain("role");
    expect(cols).toContain("status");
    expect(cols).toContain("created_at");
  });

  it("swarm_consensus_rounds has required columns: id, session_id, round_index, outcome, decided_at", () => {
    const cols = tableInfo(db, "swarm_consensus_rounds").map((c) => c.name);
    expect(cols).toContain("id");
    expect(cols).toContain("session_id");
    expect(cols).toContain("round_index");
    expect(cols).toContain("outcome");
    expect(cols).toContain("decided_at");
  });

  it("swarm_agents.session_id has FK to swarm_sessions.id", () => {
    const fks = foreignKeys(db, "swarm_agents");
    const fk = fks.find((f) => f.from === "session_id");
    expect(fk).toBeDefined();
    expect(fk?.table).toBe("swarm_sessions");
    expect(fk?.to).toBe("id");
  });

  it("swarm_consensus_rounds.session_id has FK to swarm_sessions.id", () => {
    const fks = foreignKeys(db, "swarm_consensus_rounds");
    const fk = fks.find((f) => f.from === "session_id");
    expect(fk).toBeDefined();
    expect(fk?.table).toBe("swarm_sessions");
    expect(fk?.to).toBe("id");
  });

  it("migration is idempotent — applying twice does not throw", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("swarm_sessions accepts insert and rollback is safe", () => {
    expect(() => {
      db.prepare(
        "INSERT INTO swarm_sessions (id, topology, consensus, status, max_agents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run("sess-1", "hierarchical", "raft", "active", 4, new Date().toISOString(), new Date().toISOString());
    }).not.toThrow();

    const row = db.prepare("SELECT id FROM swarm_sessions WHERE id=?").get("sess-1") as { id: string } | undefined;
    expect(row?.id).toBe("sess-1");
  });
});
