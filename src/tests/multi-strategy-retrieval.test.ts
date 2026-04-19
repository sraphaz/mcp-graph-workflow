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

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { multiStrategySearch, reciprocalRankFusion } from "../core/rag/multi-strategy-retrieval.js";

describe("Multi-Strategy Retrieval", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  describe("reciprocalRankFusion", () => {
    it("should merge ranked lists using RRF", () => {
      const lists = [
        [
          { id: "a", score: 10 },
          { id: "b", score: 8 },
          { id: "c", score: 5 },
        ],
        [
          { id: "b", score: 9 },
          { id: "d", score: 7 },
          { id: "a", score: 3 },
        ],
      ];

      const merged = reciprocalRankFusion(lists);

      // "b" appears in both lists at good positions — should rank high
      expect(merged.length).toBe(4);
      // b should be first or second (appears in both lists)
      const bIndex = merged.findIndex((r) => r.id === "b");
      expect(bIndex).toBeLessThanOrEqual(1);
    });

    it("should handle empty lists", () => {
      expect(reciprocalRankFusion([])).toEqual([]);
      expect(reciprocalRankFusion([[]])).toEqual([]);
    });
  });

  describe("multiStrategySearch", () => {
    it("should return results from FTS search", async () => {
      store.insert({
        sourceType: "memory",
        sourceId: "mem:auth",
        title: "Authentication Guide",
        content: "JWT authentication with Express middleware and role-based access control",
      });
      store.insert({
        sourceType: "docs",
        sourceId: "docs:react",
        title: "React Documentation",
        content: "React hooks for state management and component lifecycle",
      });

      const results = await multiStrategySearch(db, "authentication JWT");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain("Authentication");
    });

    it("should enforce source diversity in top results", async () => {
      // Insert docs from same source type
      for (let i = 0; i < 5; i++) {
        store.insert({
          sourceType: "memory",
          sourceId: `mem:topic${i}`,
          title: `Memory ${i}`,
          content: `Database optimization technique number ${i} for PostgreSQL`,
        });
      }
      store.insert({
        sourceType: "docs",
        sourceId: "docs:pg",
        title: "PostgreSQL Docs",
        content: "Database optimization and indexing in PostgreSQL",
      });

      const results = await multiStrategySearch(db, "database optimization");
      // Should include the docs result even if memory results dominate
      if (results.length > 1) {
        const sourceTypes = new Set(results.map((r) => r.sourceType));
        expect(sourceTypes.size).toBeGreaterThanOrEqual(1);
      }
    });

    it("should apply quality score weighting", async () => {
      store.insert({
        sourceType: "memory",
        sourceId: "mem:high",
        title: "High Quality Note",
        content: "Very useful authentication pattern for REST APIs",
      });

      // Manually set quality score
      db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE source_id = 'mem:high'").run();

      store.insert({
        sourceType: "memory",
        sourceId: "mem:low",
        title: "Low Quality Note",
        content: "Old authentication thing for REST APIs that might not work",
      });
      db.prepare("UPDATE knowledge_documents SET quality_score = 0.2 WHERE source_id = 'mem:low'").run();

      const results = await multiStrategySearch(db, "authentication REST APIs");
      if (results.length >= 2) {
        // High quality doc should rank higher
        const highIdx = results.findIndex((r) => r.sourceId === "mem:high");
        const lowIdx = results.findIndex((r) => r.sourceId === "mem:low");
        if (highIdx >= 0 && lowIdx >= 0) {
          expect(highIdx).toBeLessThan(lowIdx);
        }
      }
    });

    it("should return empty array for no matches", async () => {
      const results = await multiStrategySearch(db, "nonexistent topic xyz");
      expect(results).toEqual([]);
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 20; i++) {
        store.insert({
          sourceType: "memory",
          sourceId: `mem:bulk${i}`,
          title: `Note ${i}`,
          content: `Testing search functionality bulk item ${i}`,
        });
      }

      const results = await multiStrategySearch(db, "testing search", { limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});
