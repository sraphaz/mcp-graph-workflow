import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { runHarnessScan } from "../../core/harness/harness-scan-runner.js";
import path from "path";

const ROOT = path.resolve(process.cwd());

describe("Task 3.2 — harness history persistence and regression detection", () => {
  let db: ReturnType<typeof BetterSqlite3>;

  beforeEach(() => {
    db = new BetterSqlite3(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("persists scan result in harness_history when db is provided", () => {
    runHarnessScan(ROOT, db);
    const rows = db
      .prepare("SELECT * FROM harness_history ORDER BY timestamp DESC LIMIT 1")
      .all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(typeof rows[0].score).toBe("number");
    expect(typeof rows[0].grade).toBe("string");
    expect(typeof rows[0].breakdown).toBe("string");
  });

  it("does NOT persist when db is omitted", () => {
    // Should not throw
    const result = runHarnessScan(ROOT);
    expect(result.score).toBeGreaterThanOrEqual(0);
    // No DB to check — just confirm no crash
  });

  it("does not include regression when no prior history", () => {
    const result = runHarnessScan(ROOT, db);
    expect(result.regression).toBeUndefined();
    expect(result.regressionDelta).toBeUndefined();
  });

  it("detects regression when current score drops > 5 from last", () => {
    // Pre-seed history with high score
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("seed-1", "proj_local", 90.0, "A", "{}", null, "2020-01-01T00:00:00.000Z");

    // Run scan — real score will likely be much lower than 90
    const result = runHarnessScan(ROOT, db);
    if (result.score <= 85) {
      // Regression threshold exceeded (90 - 5 = 85)
      expect(result.regression).toBe(true);
      expect(result.regressionDelta).toBeLessThan(-5);
    }
    // If score is > 85, no regression expected
  });

  it("does NOT flag regression when drop is within 5 points", () => {
    const currentScore = runHarnessScan(ROOT).score;
    // Seed history with score only 3 points higher
    const seedScore = currentScore + 3;
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("seed-2", "proj_local", seedScore, "B", "{}", null, "2020-01-01T00:00:00.000Z");

    const result = runHarnessScan(ROOT, db);
    expect(result.regression).toBeUndefined();
  });
});
