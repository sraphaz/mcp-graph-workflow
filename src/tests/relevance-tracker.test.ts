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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { RelevanceTracker } from "../core/rag/relevance-tracker.js";

describe("RelevanceTracker", () => {
  let db: Database.Database;
  let tracker: RelevanceTracker;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    tracker = new RelevanceTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("trackQuery", () => {
    it("should record positive feedback for each document", () => {
      tracker.trackQuery("sess1", "TypeScript features", ["doc1", "doc2"]);

      const rows = db
        .prepare("SELECT * FROM relevance_feedback WHERE session_id = ?")
        .all("sess1") as Array<{ signal: string; document_id: string }>;

      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.signal === "positive")).toBe(true);
      expect(rows.map((r) => r.document_id).sort()).toEqual(["doc1", "doc2"]);
    });

    it("should store the query text", () => {
      tracker.trackQuery("sess1", "search query", ["doc1"]);

      const row = db
        .prepare("SELECT query FROM relevance_feedback WHERE session_id = ?")
        .get("sess1") as { query: string };

      expect(row.query).toBe("search query");
    });
  });

  describe("detectRequery", () => {
    it("should detect requery when term overlap >50% within 5 minutes", () => {
      tracker.trackQuery("sess1", "TypeScript compiler optimization", ["doc1", "doc2"]);

      // Similar query (high overlap)
      const result = tracker.detectRequery("sess1", "TypeScript compiler performance");

      expect(result.isRequery).toBe(true);
      expect(result.previousDocIds.sort()).toEqual(["doc1", "doc2"]);
    });

    it("should NOT detect requery for completely different query", () => {
      tracker.trackQuery("sess1", "TypeScript compiler optimization", ["doc1"]);

      const result = tracker.detectRequery("sess1", "Docker container networking");

      expect(result.isRequery).toBe(false);
    });

    it("should NOT detect requery after 5 minutes", () => {
      tracker.trackQuery("sess1", "TypeScript compiler optimization", ["doc1"]);

      vi.useFakeTimers();
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      const result = tracker.detectRequery("sess1", "TypeScript compiler optimization");
      expect(result.isRequery).toBe(false);

      vi.useRealTimers();
    });

    it("should mark previous docs as negative on requery", () => {
      tracker.trackQuery("sess1", "TypeScript compiler optimization", ["doc1", "doc2"]);

      tracker.detectRequery("sess1", "TypeScript compiler performance");

      const negatives = db
        .prepare("SELECT * FROM relevance_feedback WHERE signal = 'negative'")
        .all() as Array<{ document_id: string }>;

      expect(negatives).toHaveLength(2);
    });
  });

  describe("getRelevanceBoost", () => {
    it("should return positive boost for docs with only positive signals", () => {
      tracker.trackQuery("sess1", "query1", ["doc1"]);

      const boosts = tracker.getRelevanceBoost(["doc1"]);

      expect(boosts.get("doc1")).toBeGreaterThan(0);
    });

    it("should return negative boost for docs with more negative signals", () => {
      // 1 positive + 1 negative from requery
      tracker.trackQuery("sess1", "TypeScript compiler optimization", ["doc1"]);
      tracker.detectRequery("sess1", "TypeScript compiler performance");

      // Another positive + negative from requery
      tracker.trackQuery("sess2", "TypeScript compiler bugs", ["doc1"]);
      tracker.detectRequery("sess2", "TypeScript compiler issues");

      // Add an extra negative directly to tip the balance
      db.prepare(
        "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("extra_neg", "sess3", "q", "doc1", "negative", new Date().toISOString());

      const boosts = tracker.getRelevanceBoost(["doc1"]);

      // 2 positive, 3 negatives → (2-3)/5 * 0.2 = -0.04
      expect(boosts.get("doc1")).toBeLessThan(0);
    });

    it("should return 0 for unknown docs", () => {
      const boosts = tracker.getRelevanceBoost(["unknown_doc"]);

      expect(boosts.get("unknown_doc")).toBe(0);
    });

    it("should calculate boost as (pos-neg)/total * 0.2", () => {
      // 3 positives, 1 negative → (3-1)/4 * 0.2 = 0.1
      tracker.trackQuery("sess1", "query1", ["doc1"]);
      tracker.trackQuery("sess2", "query2", ["doc1"]);
      tracker.trackQuery("sess3", "query3", ["doc1"]);

      // Add 1 negative directly
      db.prepare(
        "INSERT INTO relevance_feedback (id, session_id, query, document_id, signal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("neg1", "sess4", "query4", "doc1", "negative", new Date().toISOString());

      const boosts = tracker.getRelevanceBoost(["doc1"]);

      expect(boosts.get("doc1")).toBeCloseTo(0.1, 2);
    });
  });
});
