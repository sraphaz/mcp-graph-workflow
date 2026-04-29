/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function tableExists(db: Database.Database, name: string): boolean {
  return (
    (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(name) as { name: string } | undefined
    ) !== undefined
  );
}

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((r) => r.name);
}

function indexNames(db: Database.Database, table: string): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=?")
      .all(table) as Array<{ name: string }>
  ).map((r) => r.name);
}

describe("migration v68 — agent_performance + reasoning_trajectories", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  afterEach(() => {
    db.close();
  });

  describe("agent_performance table", () => {
    it("creates the agent_performance table", () => {
      expect(tableExists(db, "agent_performance")).toBe(true);
    });

    it("has required columns", () => {
      const cols = columnNames(db, "agent_performance");
      expect(cols).toContain("id");
      expect(cols).toContain("project_id");
      expect(cols).toContain("agent_name");
      expect(cols).toContain("task_kind");
      expect(cols).toContain("harness_score");
      expect(cols).toContain("samples");
      expect(cols).toContain("last_used_ts");
      expect(cols).toContain("decay_factor");
      expect(cols).toContain("created_at");
      expect(cols).toContain("updated_at");
    });

    it("has at least 2 indexes (project_id, task_kind)", () => {
      const idxs = indexNames(db, "agent_performance");
      expect(idxs.length).toBeGreaterThanOrEqual(2);
    });

    it("enforces UNIQUE (project_id, agent_name, task_kind)", () => {
      db.prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
      ).run("p1", "p1");

      const insert = db.prepare(`
        INSERT INTO agent_performance (id, project_id, agent_name, task_kind, harness_score, samples, last_used_ts, decay_factor, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
      `);
      insert.run("ap1", "p1", "sonnet", "implementation", 82.5, 5, 1.0);

      expect(() => insert.run("ap2", "p1", "sonnet", "implementation", 80.0, 3, 0.9)).toThrow();
    });

    it("accepts INSERT with all required fields", () => {
      db.prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
      ).run("p1", "p1");

      db.prepare(`
        INSERT INTO agent_performance (id, project_id, agent_name, task_kind, harness_score, samples, last_used_ts, decay_factor, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
      `).run("ap1", "p1", "haiku", "design", 75.0, 12, 0.85);

      const row = db.prepare("SELECT * FROM agent_performance WHERE id=?").get("ap1") as Record<string, unknown>;
      expect(row.samples).toBe(12);
      expect(row.last_used_ts).toBeTruthy();
      expect(row.agent_name).toBe("haiku");
    });
  });

  describe("reasoning_trajectories table", () => {
    it("creates the reasoning_trajectories table", () => {
      expect(tableExists(db, "reasoning_trajectories")).toBe(true);
    });

    it("has required columns", () => {
      const cols = columnNames(db, "reasoning_trajectories");
      expect(cols).toContain("id");
      expect(cols).toContain("project_id");
      expect(cols).toContain("node_id");
      expect(cols).toContain("agent_name");
      expect(cols).toContain("task_kind");
      expect(cols).toContain("trajectory");
      expect(cols).toContain("outcome_score");
      expect(cols).toContain("samples");
      expect(cols).toContain("last_used_ts");
      expect(cols).toContain("created_at");
    });

    it("has at least 2 indexes", () => {
      const idxs = indexNames(db, "reasoning_trajectories");
      expect(idxs.length).toBeGreaterThanOrEqual(2);
    });

    it("node_id is a nullable FK — can be NULL", () => {
      db.prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
      ).run("p1", "p1");

      db.prepare(`
        INSERT INTO reasoning_trajectories (id, project_id, node_id, agent_name, task_kind, trajectory, outcome_score, samples, last_used_ts, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run("rt1", "p1", "sonnet", "implementation", '{"steps":[]}', 90.0, 1);

      const row = db.prepare("SELECT * FROM reasoning_trajectories WHERE id=?").get("rt1") as Record<string, unknown>;
      expect(row.node_id).toBeNull();
      expect(row.samples).toBe(1);
      expect(row.last_used_ts).toBeTruthy();
    });

    it("node_id references nodes table", () => {
      db.prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
      ).run("p1", "p1");

      // Insert a valid node
      db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
      ).run("n1", "p1", "task", "Sample Task", "backlog", 2);

      db.prepare(`
        INSERT INTO reasoning_trajectories (id, project_id, node_id, agent_name, task_kind, trajectory, outcome_score, samples, last_used_ts, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run("rt1", "p1", "n1", "sonnet", "implementation", '{"steps":["read","plan","implement"]}', 88.5, 3);

      const row = db.prepare("SELECT * FROM reasoning_trajectories WHERE id=?").get("rt1") as Record<string, unknown>;
      expect(row.node_id).toBe("n1");
    });
  });

  it("migration is idempotent — running again does not throw", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });
});
