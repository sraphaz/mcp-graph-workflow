/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-9.T02 — decisions store tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  recordDecision,
  recordOutcome,
  listDecisions,
  statsDecisions,
  auditDecisions,
  AUDIT_STALE_DAYS,
} from "../core/decisions/decisions-store.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("decisions-store (E9.T02)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("AUDIT_STALE_DAYS = 7", () => {
    expect(AUDIT_STALE_DAYS).toBe(7);
  });

  it("migration v80 creates decisions table", () => {
    const cols = db
      .prepare("PRAGMA table_info(decisions)")
      .all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const col of [
      "id", "intent", "options_json", "chosen", "reasoning",
      "node_id", "success", "result_summary", "outcome_at", "created_at",
    ]) {
      expect(names.has(col), `missing decisions.${col}`).toBe(true);
    }
  });

  describe("recordDecision", () => {
    it("INSERT with valid input returns decisionId", () => {
      const id = recordDecision(db, {
        intent: "model-choice",
        options: ["sonnet", "haiku"],
        chosen: "sonnet",
        reasoning: "no testable AC → escalate",
      });
      expect(id).toMatch(/^dec-/);
    });

    it("throws when options[] is empty", () => {
      expect(() =>
        recordDecision(db, {
          intent: "x",
          options: [],
          chosen: "x",
          reasoning: "r",
        }),
      ).toThrow(/options/);
    });

    it("throws when chosen is not in options", () => {
      expect(() =>
        recordDecision(db, {
          intent: "x",
          options: ["a", "b"],
          chosen: "c",
          reasoning: "r",
        }),
      ).toThrow(/chosen/);
    });
  });

  describe("recordOutcome", () => {
    it("updates success + result_summary + outcome_at", () => {
      const id = recordDecision(db, {
        intent: "i", options: ["a", "b"], chosen: "a", reasoning: "r",
      });
      expect(recordOutcome(db, id, { success: true, summary: "worked" })).toBe(true);
      const [row] = listDecisions(db);
      expect(row.success).toBe(true);
      expect(row.outcomeAt).toBeDefined();
      expect(row.resultSummary).toBe("worked");
    });

    it("returns false for unknown decisionId", () => {
      expect(recordOutcome(db, "nonexistent", { success: false, summary: "x" })).toBe(false);
    });
  });

  describe("listDecisions", () => {
    it("returns all decisions sorted by created_at DESC", () => {
      const id1 = recordDecision(db, { intent: "i1", options: ["a"], chosen: "a", reasoning: "r" });
      const id2 = recordDecision(db, { intent: "i2", options: ["a"], chosen: "a", reasoning: "r" });
      const list = listDecisions(db);
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2);
      expect(list[1].id).toBe(id1);
    });

    it("filters by nodeId", () => {
      recordDecision(db, { intent: "x", options: ["a"], chosen: "a", reasoning: "r", nodeId: "n1" });
      recordDecision(db, { intent: "y", options: ["a"], chosen: "a", reasoning: "r", nodeId: "n2" });
      const onlyN1 = listDecisions(db, { nodeId: "n1" });
      expect(onlyN1).toHaveLength(1);
      expect(onlyN1[0].nodeId).toBe("n1");
    });
  });

  describe("statsDecisions", () => {
    it("aggregates counts and success rate per intent", () => {
      const a = recordDecision(db, { intent: "model", options: ["x"], chosen: "x", reasoning: "r" });
      const b = recordDecision(db, { intent: "model", options: ["x"], chosen: "x", reasoning: "r" });
      recordDecision(db, { intent: "model", options: ["x"], chosen: "x", reasoning: "r" });
      recordDecision(db, { intent: "scope", options: ["x"], chosen: "x", reasoning: "r" });
      recordOutcome(db, a, { success: true, summary: "" });
      recordOutcome(db, b, { success: false, summary: "" });

      const s = statsDecisions(db);
      expect(s.totalDecisions).toBe(4);
      expect(s.byIntent.model.count).toBe(3);
      expect(s.byIntent.model.outcomes).toBe(2);
      expect(s.byIntent.model.successRate).toBeCloseTo(0.5);
      expect(s.byIntent.scope.count).toBe(1);
      expect(s.byIntent.scope.successRate).toBe(0); // no outcomes recorded
    });

    it("returns empty stats on empty store", () => {
      expect(statsDecisions(db)).toEqual({ totalDecisions: 0, byIntent: {} });
    });
  });

  describe("auditDecisions", () => {
    it("returns only decisions older than 7d without outcome", () => {
      const id1 = recordDecision(db, { intent: "i", options: ["a"], chosen: "a", reasoning: "r" });
      // back-date this row to 10 days ago
      const tenDaysAgo = new Date(Date.now() - 10 * DAY_MS).toISOString();
      db.prepare(`UPDATE decisions SET created_at = ? WHERE id = ?`).run(tenDaysAgo, id1);

      const id2 = recordDecision(db, { intent: "i", options: ["a"], chosen: "a", reasoning: "r" });
      // recent decision should NOT appear in audit

      const id3 = recordDecision(db, { intent: "i", options: ["a"], chosen: "a", reasoning: "r" });
      db.prepare(`UPDATE decisions SET created_at = ? WHERE id = ?`).run(tenDaysAgo, id3);
      recordOutcome(db, id3, { success: true, summary: "done" });
      // old but with outcome → not in audit

      const stale = auditDecisions(db);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe(id1);
      expect([id2, id3]).not.toContain(stale[0].id);
    });

    it("filters audit by nodeId", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * DAY_MS).toISOString();
      const a = recordDecision(db, { intent: "i", options: ["x"], chosen: "x", reasoning: "r", nodeId: "n1" });
      const b = recordDecision(db, { intent: "i", options: ["x"], chosen: "x", reasoning: "r", nodeId: "n2" });
      db.prepare(`UPDATE decisions SET created_at = ? WHERE id IN (?, ?)`).run(tenDaysAgo, a, b);

      const onlyN1 = auditDecisions(db, { nodeId: "n1" });
      expect(onlyN1).toHaveLength(1);
      expect(onlyN1[0].nodeId).toBe("n1");
    });

    it("custom staleDays threshold", () => {
      const id = recordDecision(db, { intent: "i", options: ["x"], chosen: "x", reasoning: "r" });
      const twoDaysAgo = new Date(Date.now() - 2 * DAY_MS).toISOString();
      db.prepare(`UPDATE decisions SET created_at = ? WHERE id = ?`).run(twoDaysAgo, id);

      expect(auditDecisions(db, { staleDays: 7 })).toHaveLength(0);
      expect(auditDecisions(db, { staleDays: 1 })).toHaveLength(1);
    });
  });
});
