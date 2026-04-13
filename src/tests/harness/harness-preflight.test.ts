/**
 * TDD: harness-preflight — getHarnessPreflightWarning
 *
 * Tests for the pre-flight harness warning that runs during start_task.
 * Returns warning when last harness score is < 70 (grade C/D).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { getHarnessPreflightWarning } from "../../core/harness/harness-preflight.js";

describe("getHarnessPreflightWarning", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = new BetterSqlite3(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns null when no harness_history exists", () => {
    const result = getHarnessPreflightWarning(db);
    expect(result).toBeNull();
  });

  it("returns null when last score is grade A (>= 85)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_1", "test", 90, "A", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).toBeNull();
  });

  it("returns null when last score is grade B (>= 70)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_1", "test", 75, "B", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).toBeNull();
  });

  it("returns warning when last score is grade C (< 70)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_1", "test", 60, "C", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(60);
    expect(result!.grade).toBe("C");
    expect(result!.message).toContain("caution");
  });

  it("returns warning when last score is grade D (< 55)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_1", "test", 40, "D", '{"types":{"score":40}}', "2026-04-12T10:00:00Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(40);
    expect(result!.grade).toBe("D");
    expect(result!.message).toContain("High hallucination risk");
  });

  it("uses the most recent snapshot (not oldest)", () => {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_old", "test", 40, "D", "{}", "2026-04-10T10:00:00Z");

    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run("hh_new", "test", 85, "A", "{}", "2026-04-12T10:00:00Z");

    const result = getHarnessPreflightWarning(db);
    expect(result).toBeNull();
  });
});
