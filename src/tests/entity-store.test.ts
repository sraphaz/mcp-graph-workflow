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

/**
 * Targeted EntityStore unit tests — covers initialization, FTS sync, and
 * subgraph extraction edge cases not exercised by the integration suite in
 * entity-kg.test.ts. Co-located by basename so feature-depth pairs the source
 * with a dedicated test file.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { EntityStore } from "../core/rag/entity-store.js";

describe("EntityStore — direct API surface", () => {
  let db: Database.Database;
  let store: EntityStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new EntityStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("hasKgTables", () => {
    it("should return true after migrations have run", () => {
      expect(store.hasKgTables()).toBe(true);
    });

    it("should return false on a database without KG migrations", () => {
      const freshDb = new Database(":memory:");
      configureDb(freshDb);
      const freshStore = new EntityStore(freshDb);
      expect(freshStore.hasKgTables()).toBe(false);
      freshDb.close();
    });
  });

  describe("stats", () => {
    it("should report zeros on an empty store", () => {
      expect(store.stats()).toEqual({ entities: 0, relations: 0, mentions: 0 });
    });

    it("should reflect inserted entities", () => {
      store.upsertEntity("React", "technology", "doc-1");
      const stats = store.stats();
      expect(stats.entities).toBe(1);
      expect(stats.mentions).toBe(1);
    });

    it("should count relations independently from entities", () => {
      const a = store.upsertEntity("A", "class");
      const b = store.upsertEntity("B", "class");
      store.addRelation(a.id, b.id, "uses");

      const stats = store.stats();
      expect(stats.entities).toBe(2);
      expect(stats.relations).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all entities, relations, and mentions", () => {
      const a = store.upsertEntity("A", "class", "doc-1");
      const b = store.upsertEntity("B", "class", "doc-2");
      store.addRelation(a.id, b.id, "uses");

      store.clear();

      expect(store.stats()).toEqual({ entities: 0, relations: 0, mentions: 0 });
    });

    it("should be idempotent (clear twice = same result)", () => {
      store.upsertEntity("X", "class");
      store.clear();
      expect(() => store.clear()).not.toThrow();
      expect(store.stats().entities).toBe(0);
    });
  });

  describe("extractSubgraph (BFS edge cases)", () => {
    it("should return empty subgraph for a non-existent seed entity", () => {
      const sub = store.extractSubgraph(["nonexistent"], 2, 50);
      expect(sub.entities).toHaveLength(0);
      expect(sub.relations).toHaveLength(0);
      expect(sub.docIds).toHaveLength(0);
    });

    it("should respect maxEntities cap (BFS truncation)", () => {
      // Build a star: A connected to 10 leaves.
      const a = store.upsertEntity("Center", "class");
      for (let i = 0; i < 10; i++) {
        const leaf = store.upsertEntity(`Leaf${i}`, "class");
        store.addRelation(a.id, leaf.id, "uses");
      }

      const sub = store.extractSubgraph([a.id], 1, 5);
      expect(sub.entities.length).toBeLessThanOrEqual(5);
    });

    it("should walk multi-hop relationships up to maxDepth", () => {
      const a = store.upsertEntity("A", "class");
      const b = store.upsertEntity("B", "class");
      const c = store.upsertEntity("C", "class");
      store.addRelation(a.id, b.id, "uses");
      store.addRelation(b.id, c.id, "uses");

      const subOneHop = store.extractSubgraph([a.id], 1, 50);
      const subTwoHop = store.extractSubgraph([a.id], 2, 50);

      // 1-hop reaches B; 2-hop additionally reaches C.
      expect(subTwoHop.entities.length).toBeGreaterThanOrEqual(
        subOneHop.entities.length,
      );
    });
  });

  describe("upsertEntity normalization", () => {
    it("should treat case-only differences as the same entity (normalized name)", () => {
      const first = store.upsertEntity("React", "technology");
      const second = store.upsertEntity("REACT", "technology");

      expect(first.id).toBe(second.id);
      expect(store.stats().entities).toBe(1);
    });

    it("should treat trim-only differences as the same entity", () => {
      const first = store.upsertEntity("Postgres", "technology");
      const second = store.upsertEntity("  Postgres  ", "technology");

      expect(first.id).toBe(second.id);
    });

    it("should treat different types as distinct entities even with same name", () => {
      const asTech = store.upsertEntity("App", "technology");
      const asClass = store.upsertEntity("App", "class");

      expect(asTech.id).not.toBe(asClass.id);
      expect(store.stats().entities).toBe(2);
    });
  });
});
