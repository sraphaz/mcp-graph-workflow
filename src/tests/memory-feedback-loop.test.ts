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
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { applyRagFeedback, deriveFeedbackSignal } from "../core/rag/rag-feedback.js";

describe("rag-feedback — citation→quality signal loop", () => {
  let db: Database.Database;
  let store: KnowledgeStore;
  let docIdA: string;
  let docIdB: string;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
    const a = store.insert({ sourceType: "memory", sourceId: "test-a", title: "A", content: "alpha content" });
    const b = store.insert({ sourceType: "memory", sourceId: "test-b", title: "B", content: "beta content" });
    docIdA = a.id;
    docIdB = b.id;
    // Reset both to a known baseline so the test asserts movement explicitly.
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.5 WHERE id IN (?, ?)").run(docIdA, docIdB);
  });

  afterEach(() => {
    db.close();
  });

  describe("deriveFeedbackSignal", () => {
    it("returns 'helpful' for grade A + test pass", () => {
      expect(deriveFeedbackSignal("A", "passed", 0)).toBe("helpful");
    });
    it("returns 'unhelpful' for grade D regardless of test gate", () => {
      expect(deriveFeedbackSignal("D", "passed", 0)).toBe("unhelpful");
      expect(deriveFeedbackSignal("D", "failed", 1)).toBe("unhelpful");
    });
    it("returns 'unhelpful' when test gate fails ≥ 2 times", () => {
      expect(deriveFeedbackSignal("B", "failed", 2)).toBe("unhelpful");
    });
    it("returns 'neutral' for ambiguous mid-grade single failure", () => {
      expect(deriveFeedbackSignal("B", "failed", 1)).toBe("neutral");
      expect(deriveFeedbackSignal("C", "passed", 0)).toBe("neutral");
    });
    it("returns 'helpful' only when both grade ≥ B AND tests pass", () => {
      expect(deriveFeedbackSignal("B", "passed", 0)).toBe("helpful");
    });
  });

  describe("applyRagFeedback", () => {
    it("boosts quality of every offered docId on 'helpful'", () => {
      applyRagFeedback(db, [docIdA, docIdB], "helpful", "test-query");
      const rows = db.prepare("SELECT id, quality_score FROM knowledge_documents WHERE id IN (?, ?)").all(docIdA, docIdB) as Array<{ id: string; quality_score: number }>;
      for (const row of rows) {
        expect(row.quality_score).toBeGreaterThan(0.5);
      }
    });

    it("penalizes quality on 'unhelpful'", () => {
      applyRagFeedback(db, [docIdA], "unhelpful", "test-query");
      const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(docIdA) as { quality_score: number };
      expect(row.quality_score).toBeLessThan(0.5);
    });

    it("is a no-op for 'neutral' signal", () => {
      applyRagFeedback(db, [docIdA, docIdB], "neutral", "test-query");
      const rows = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id IN (?, ?)").all(docIdA, docIdB) as Array<{ quality_score: number }>;
      for (const row of rows) {
        expect(row.quality_score).toBe(0.5);
      }
    });

    it("is a no-op for empty docId list", () => {
      expect(() => applyRagFeedback(db, [], "helpful", "test-query")).not.toThrow();
    });

    it("does not crash on unknown docId — warns and continues", () => {
      expect(() => applyRagFeedback(db, ["kdoc_does_not_exist", docIdA], "helpful", "test-query")).not.toThrow();
      const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get(docIdA) as { quality_score: number };
      expect(row.quality_score).toBeGreaterThan(0.5);
    });
  });
});
