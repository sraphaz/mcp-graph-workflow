/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 46 — contract_violations table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create contract_violations table with correct columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(contract_violations)")
      .all() as Array<{ name: string; type: string }>;

    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("rule_id");
    expect(columnNames).toContain("file");
    expect(columnNames).toContain("line");
    expect(columnNames).toContain("message");
    expect(columnNames).toContain("severity");
    expect(columnNames).toContain("node_id");
    expect(columnNames).toContain("created_at");
    expect(columns.length).toBe(8);
  });

  it("should have correct column types", () => {
    const columns = db
      .prepare("PRAGMA table_info(contract_violations)")
      .all() as Array<{ name: string; type: string }>;

    const colMap = new Map(columns.map((c) => [c.name, c.type]));

    expect(colMap.get("id")).toBe("INTEGER");
    expect(colMap.get("rule_id")).toBe("TEXT");
    expect(colMap.get("file")).toBe("TEXT");
    expect(colMap.get("line")).toBe("INTEGER");
    expect(colMap.get("message")).toBe("TEXT");
    expect(colMap.get("severity")).toBe("TEXT");
    expect(colMap.get("node_id")).toBe("TEXT");
    expect(colMap.get("created_at")).toBe("TEXT");
  });

  it("should have index on (node_id, created_at)", () => {
    const indexes = db
      .prepare("PRAGMA index_list(contract_violations)")
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_contract_violations_node_created");
  });

  it("should insert and retrieve violations correctly", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO contract_violations (rule_id, file, line, message, severity, node_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("import_direction", "src/core/foo.ts", 5, "core cannot import cli", "error", "node_abc", now);

    const rows = db
      .prepare("SELECT * FROM contract_violations WHERE node_id = ?")
      .all("node_abc") as Array<{ rule_id: string; severity: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].rule_id).toBe("import_direction");
    expect(rows[0].severity).toBe("error");
  });

  it("should allow multiple violations for same node", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO contract_violations (rule_id, file, line, message, severity, node_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("import_direction", "src/core/a.ts", 1, "violation 1", "error", "node_abc", now);

    db.prepare(
      `INSERT INTO contract_violations (rule_id, file, line, message, severity, node_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("naming", "src/core/b.ts", 10, "violation 2", "warning", "node_abc", now);

    const rows = db
      .prepare("SELECT * FROM contract_violations WHERE node_id = ? ORDER BY created_at")
      .all("node_abc");

    expect(rows).toHaveLength(2);
  });

  it("should auto-increment id as primary key", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO contract_violations (rule_id, file, line, message, severity, node_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("rule1", "f1.ts", 1, "msg1", "error", "n1", now);

    db.prepare(
      `INSERT INTO contract_violations (rule_id, file, line, message, severity, node_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("rule2", "f2.ts", 2, "msg2", "warning", "n2", now);

    const rows = db
      .prepare("SELECT id FROM contract_violations ORDER BY id")
      .all() as Array<{ id: number }>;

    expect(rows[0].id).toBe(1);
    expect(rows[1].id).toBe(2);
  });
});
