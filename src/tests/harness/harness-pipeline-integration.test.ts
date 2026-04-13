import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { getHarnessPreflightWarning } from "../../core/harness/harness-preflight.js";
import { getHarnessRegressionReport } from "../../core/harness/harness-preflight.js";

const BREAKDOWN_A = JSON.stringify({
  types: { score: 90 }, tests: { score: 88 }, fitness: { score: 90 },
  docs: { score: 85 }, naming: { score: 92 }, errors: { score: 88 }, context: { score: 87 },
});
const BREAKDOWN_D = JSON.stringify({
  types: { score: 30 }, tests: { score: 20 }, fitness: { score: 40 },
  docs: { score: 10 }, naming: { score: 35 }, errors: { score: 25 }, context: { score: 30 },
});

describe("Task 4.1 — harness pre-flight (start_task)", () => {
  let db: ReturnType<typeof BetterSqlite3>;

  beforeEach(() => {
    db = new BetterSqlite3(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns null warning when no history exists", () => {
    const result = getHarnessPreflightWarning(db);
    expect(result).toBeNull();
  });

  it("returns null warning when last score is grade A (>= 85)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s1", "proj", 88, "A", BREAKDOWN_A, null, "2024-01-01T00:00:00.000Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).toBeNull();
  });

  it("returns warning when last score is grade D (< 55)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s1", "proj", 45, "D", BREAKDOWN_D, null, "2024-01-01T00:00:00.000Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).not.toBeNull();
    expect(result!.grade).toBe("D");
    expect(result!.score).toBe(45);
    expect(typeof result!.message).toBe("string");
  });

  it("returns warning when last score is grade C (< 70)", () => {
    const breakdownC = JSON.stringify({
      types: { score: 60 }, tests: { score: 55 }, fitness: { score: 65 },
      docs: { score: 50 }, naming: { score: 60 }, errors: { score: 58 }, context: { score: 52 },
    });
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s1", "proj", 58, "C", breakdownC, null, "2024-01-01T00:00:00.000Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).not.toBeNull();
    expect(result!.grade).toBe("C");
  });
});

describe("Task 4.2 — harness post-check (finish_task)", () => {
  let db: ReturnType<typeof BetterSqlite3>;

  beforeEach(() => {
    db = new BetterSqlite3(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns null when fewer than 2 scans in history", () => {
    const result = getHarnessRegressionReport(db, 70);
    expect(result).toBeNull();
  });

  it("returns null when score improved between last 2 scans", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s1", "proj", 70, "B", BREAKDOWN_A, null, "2024-01-01T00:00:00.000Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s2", "proj", 80, "B", BREAKDOWN_A, null, "2024-01-02T00:00:00.000Z");

    const result = getHarnessRegressionReport(db, 80);
    expect(result).toBeNull();
  });

  it("returns regression report when score dropped > 5 pts between last 2 scans", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s1", "proj", 80, "B", BREAKDOWN_A, null, "2024-01-01T00:00:00.000Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s2", "proj", 60, "C", BREAKDOWN_D, null, "2024-01-02T00:00:00.000Z");

    const result = getHarnessRegressionReport(db, 60);
    expect(result).not.toBeNull();
    expect(result!.delta).toBeCloseTo(-20, 1);
    expect(result!.before).toBe(80);
    expect(result!.after).toBe(60);
  });

  it("returns null when drop is <= 5 pts (noise threshold)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s1", "proj", 80, "B", BREAKDOWN_A, null, "2024-01-01T00:00:00.000Z");
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("s2", "proj", 76, "B", BREAKDOWN_A, null, "2024-01-02T00:00:00.000Z");

    const result = getHarnessRegressionReport(db, 76);
    expect(result).toBeNull();
  });
});
