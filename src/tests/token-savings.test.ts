import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  recordTokenSaving,
  getTokenSavingsReport,
} from "../core/rag/token-savings.js";

describe("Token Savings Metrics", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("recordTokenSaving", () => {
    it("should record a token saving entry", () => {
      recordTokenSaving(db, "context", 500, 200);

      const rows = db
        .prepare("SELECT * FROM token_savings")
        .all() as Array<{ tool: string; input_tokens: number; output_tokens: number }>;

      expect(rows).toHaveLength(1);
      expect(rows[0].tool).toBe("context");
      expect(rows[0].input_tokens).toBe(500);
      expect(rows[0].output_tokens).toBe(200);
    });
  });

  describe("getTokenSavingsReport", () => {
    it("should aggregate savings by tool", () => {
      recordTokenSaving(db, "context", 500, 200);
      recordTokenSaving(db, "context", 300, 100);
      recordTokenSaving(db, "rag_context", 1000, 400);

      const report = getTokenSavingsReport(db);

      expect(report.byTool.length).toBe(2);
      const contextEntry = report.byTool.find((t) => t.tool === "context")!;
      expect(contextEntry.totalInputTokens).toBe(800);
      expect(contextEntry.totalOutputTokens).toBe(300);
      expect(contextEntry.totalSaved).toBe(500);
      expect(contextEntry.calls).toBe(2);
    });

    it("should calculate total savings", () => {
      recordTokenSaving(db, "context", 500, 200);
      recordTokenSaving(db, "rag_context", 1000, 400);

      const report = getTokenSavingsReport(db);

      expect(report.totalInputTokens).toBe(1500);
      expect(report.totalOutputTokens).toBe(600);
      expect(report.totalSaved).toBe(900);
      expect(report.savingsPercent).toBe(60);
    });

    it("should return zero for empty store", () => {
      const report = getTokenSavingsReport(db);

      expect(report.totalSaved).toBe(0);
      expect(report.savingsPercent).toBe(0);
      expect(report.byTool).toHaveLength(0);
    });
  });
});
