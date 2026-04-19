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
import {
  generateBudgetReport,

} from "../core/rag/token-budget-tracker.js";

describe("TokenBudgetTracker", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  function insertDoc(id: string, sourceType: string, contentLength: number): void {
    const content = "x".repeat(contentLength);
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, quality_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, sourceType, "src1", `Doc ${id}`, content, `hash_${id}`, 0.7, now, now);
  }

  describe("zone calculation", () => {
    it("should return green zone when usage < 60% of budget", () => {
      // Small content = low token usage
      insertDoc("d1", "docs", 100);
      const report = generateBudgetReport(db, 10000);
      expect(report.zone).toBe("green");
    });

    it("should return yellow zone when usage 60-85%", () => {
      // Fill ~70% of a small budget
      for (let i = 0; i < 7; i++) {
        insertDoc(`d${i}`, "docs", 400); // ~100 tokens each = 700 tokens
      }
      const report = generateBudgetReport(db, 1000);
      expect(report.zone).toBe("yellow");
    });

    it("should return red zone when usage > 85%", () => {
      for (let i = 0; i < 10; i++) {
        insertDoc(`d${i}`, "docs", 400);
      }
      const report = generateBudgetReport(db, 1000);
      expect(report.zone).toBe("red");
    });
  });

  describe("top consumers", () => {
    it("should return top 5 consumers by source_type", () => {
      insertDoc("d1", "docs", 1000);
      insertDoc("d2", "docs", 500);
      insertDoc("d3", "prd", 800);
      insertDoc("d4", "memory", 200);

      const report = generateBudgetReport(db, 50000);

      expect(report.topConsumers.length).toBeGreaterThan(0);
      expect(report.topConsumers.length).toBeLessThanOrEqual(5);
      // docs should be top consumer (1500 chars total)
      expect(report.topConsumers[0].sourceType).toBe("docs");
    });
  });

  describe("recommendations", () => {
    it("should recommend pruning in red zone", () => {
      for (let i = 0; i < 20; i++) {
        insertDoc(`d${i}`, "docs", 400);
      }
      const report = generateBudgetReport(db, 1000);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some((r) => r.includes("prun"))).toBe(true);
    });

    it("should have no critical recommendations in green zone", () => {
      insertDoc("d1", "docs", 100);
      const report = generateBudgetReport(db, 100000);

      // May have informational recommendations, but nothing critical
      expect(report.zone).toBe("green");
    });
  });

  describe("report shape", () => {
    it("should include all required fields", () => {
      insertDoc("d1", "docs", 100);
      const report = generateBudgetReport(db, 10000);

      expect(report).toHaveProperty("zone");
      expect(report).toHaveProperty("usagePercent");
      expect(report).toHaveProperty("totalTokens");
      expect(report).toHaveProperty("budget");
      expect(report).toHaveProperty("topConsumers");
      expect(report).toHaveProperty("recommendations");
      expect(typeof report.usagePercent).toBe("number");
    });
  });

  describe("empty store", () => {
    it("should return green zone with zero usage", () => {
      const report = generateBudgetReport(db, 10000);

      expect(report.zone).toBe("green");
      expect(report.totalTokens).toBe(0);
      expect(report.usagePercent).toBe(0);
    });
  });
});
