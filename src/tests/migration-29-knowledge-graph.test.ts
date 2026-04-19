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

describe("Knowledge Graph tables (migration v12)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("kg_entities table", () => {
    it("should exist with required columns", () => {
      const cols = db
        .prepare("PRAGMA table_info(kg_entities)")
        .all() as Array<{ name: string; notnull: number }>;

      const colMap = new Map(cols.map((c) => [c.name, c]));

      expect(colMap.has("id")).toBe(true);
      expect(colMap.has("name")).toBe(true);
      expect(colMap.has("type")).toBe(true);
      expect(colMap.has("normalized_name")).toBe(true);
      expect(colMap.has("mention_count")).toBe(true);
      expect(colMap.has("created_at")).toBe(true);
      expect(colMap.get("name")!.notnull).toBe(1);
      expect(colMap.get("type")!.notnull).toBe(1);
    });
  });

  describe("kg_relations table", () => {
    it("should exist with required columns including weight", () => {
      const cols = db
        .prepare("PRAGMA table_info(kg_relations)")
        .all() as Array<{ name: string }>;

      const names = cols.map((c) => c.name);

      expect(names).toContain("id");
      expect(names).toContain("from_entity_id");
      expect(names).toContain("to_entity_id");
      expect(names).toContain("relation_type");
      expect(names).toContain("weight");
    });

    it("should have indexes on entity columns", () => {
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='kg_relations'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames.some((n) => n.includes("from"))).toBe(true);
      expect(indexNames.some((n) => n.includes("to"))).toBe(true);
    });
  });

  describe("kg_mentions table", () => {
    it("should exist linking entities to documents", () => {
      const cols = db
        .prepare("PRAGMA table_info(kg_mentions)")
        .all() as Array<{ name: string }>;

      const names = cols.map((c) => c.name);

      expect(names).toContain("entity_id");
      expect(names).toContain("doc_id");
    });
  });
});
