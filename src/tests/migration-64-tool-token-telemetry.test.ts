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

describe("Migration 64 — tool_token_usage telemetry columns (V11 Maestro Phase 1)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should add success, duration_ms, error_kind columns to tool_token_usage", () => {
    const columns = db
      .prepare("PRAGMA table_info(tool_token_usage)")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("success");
    expect(columnNames).toContain("duration_ms");
    expect(columnNames).toContain("error_kind");
  });

  it("should make telemetry columns nullable (backward compat)", () => {
    const columns = db
      .prepare("PRAGMA table_info(tool_token_usage)")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const colMap = new Map(columns.map((c) => [c.name, c]));
    expect(colMap.get("success")?.notnull).toBe(0);
    expect(colMap.get("duration_ms")?.notnull).toBe(0);
    expect(colMap.get("error_kind")?.notnull).toBe(0);
  });

  it("should use correct column types (INTEGER/TEXT)", () => {
    const columns = db
      .prepare("PRAGMA table_info(tool_token_usage)")
      .all() as Array<{ name: string; type: string }>;

    const colMap = new Map(columns.map((c) => [c.name, c.type]));
    expect(colMap.get("success")).toBe("INTEGER");
    expect(colMap.get("duration_ms")).toBe("INTEGER");
    expect(colMap.get("error_kind")).toBe("TEXT");
  });

  it("should accept INSERTs without telemetry columns (backward compat)", () => {
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ('p1', 'Test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run();

    expect(() => {
      db.prepare(
        `INSERT INTO tool_token_usage (project_id, tool_name, input_tokens, output_tokens, called_at)
         VALUES ('p1', 'list', 100, 200, '2026-01-01T00:00:00Z')`,
      ).run();
    }).not.toThrow();

    const row = db
      .prepare("SELECT * FROM tool_token_usage WHERE tool_name = 'list'")
      .get() as { success: number | null; duration_ms: number | null; error_kind: string | null };

    expect(row.success).toBeNull();
    expect(row.duration_ms).toBeNull();
    expect(row.error_kind).toBeNull();
  });

  it("should accept INSERTs WITH telemetry columns populated", () => {
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ('p1', 'Test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run();

    db.prepare(
      `INSERT INTO tool_token_usage
         (project_id, tool_name, input_tokens, output_tokens, called_at, success, duration_ms, error_kind)
       VALUES ('p1', 'analyze', 500, 1200, '2026-01-01T00:00:00Z', 1, 247, NULL)`,
    ).run();

    const row = db
      .prepare("SELECT * FROM tool_token_usage WHERE tool_name = 'analyze'")
      .get() as { success: number; duration_ms: number; error_kind: string | null };

    expect(row.success).toBe(1);
    expect(row.duration_ms).toBe(247);
    expect(row.error_kind).toBeNull();
  });

  it("should allow error_kind for failed calls", () => {
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ('p1', 'Test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run();

    db.prepare(
      `INSERT INTO tool_token_usage
         (project_id, tool_name, input_tokens, output_tokens, called_at, success, duration_ms, error_kind)
       VALUES ('p1', 'export', 0, 0, '2026-01-01T00:00:00Z', 0, 1500, 'timeout')`,
    ).run();

    const row = db
      .prepare("SELECT * FROM tool_token_usage WHERE tool_name = 'export'")
      .get() as { success: number; error_kind: string };

    expect(row.success).toBe(0);
    expect(row.error_kind).toBe("timeout");
  });

  it("should be tracked as version 64 in _migrations", () => {
    const m = db
      .prepare("SELECT version, description FROM _migrations WHERE version = 64")
      .get() as { version: number; description: string } | undefined;

    expect(m).toBeDefined();
    expect(m?.version).toBe(64);
    expect(m?.description.toLowerCase()).toMatch(/telemetr|maestro|tool_token/);
  });
});
