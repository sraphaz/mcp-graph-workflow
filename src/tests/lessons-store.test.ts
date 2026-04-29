/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D4 + D5 — lessons-store tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  persistLesson,
  persistLessonsFromPatterns,
  consultLessons,
  getLessonByHash,
  PATTERN_TO_LESSON_THRESHOLD,
} from "../core/autonomy/lessons-store.js";

describe("lessons-store (E22.D4 + D5)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("PATTERN_TO_LESSON_THRESHOLD = 3", () => {
    expect(PATTERN_TO_LESSON_THRESHOLD).toBe(3);
  });

  describe("persistLesson", () => {
    it("INSERT new lesson with applied_count=1", () => {
      const l = persistLesson(db, {
        patternHash: "h1",
        description: "ECONNRESET pattern",
        recommendedAction: "skip-similar",
        confidence: 0.8,
        source: "retry-worker",
      });
      expect(l.appliedCount).toBe(1);
      expect(l.source).toBe("retry-worker");
      expect(l.confidence).toBe(0.8);
    });

    it("UPSERT increments applied_count + keeps higher confidence", () => {
      persistLesson(db, {
        patternHash: "h2",
        description: "rate limit",
        recommendedAction: "wait",
        confidence: 0.5,
      });
      const l = persistLesson(db, {
        patternHash: "h2",
        description: "rate limit",
        recommendedAction: "wait",
        confidence: 0.9,
      });
      expect(l.appliedCount).toBe(2);
      expect(l.confidence).toBe(0.9);
    });

    it("UPSERT does NOT lower confidence", () => {
      persistLesson(db, {
        patternHash: "h3",
        description: "x",
        recommendedAction: "y",
        confidence: 0.95,
      });
      const l = persistLesson(db, {
        patternHash: "h3",
        description: "x",
        recommendedAction: "y",
        confidence: 0.3,
      });
      expect(l.confidence).toBe(0.95);
    });

    it("default source is 'unknown'", () => {
      const l = persistLesson(db, {
        patternHash: "h4",
        description: "x",
        recommendedAction: "y",
      });
      expect(l.source).toBe("unknown");
    });
  });

  describe("persistLessonsFromPatterns (D4)", () => {
    it("only persists patterns with count >= threshold", () => {
      const persisted = persistLessonsFromPatterns(db, [
        { patternHash: "low", description: "rare", count: 1 },
        { patternHash: "med", description: "some", count: 2 },
        { patternHash: "high", description: "frequent ECONNRESET", count: 4 },
      ]);
      expect(persisted).toHaveLength(1);
      expect(persisted[0].patternHash).toBe("high");
    });

    it("source defaults to 'dream-wake'", () => {
      persistLessonsFromPatterns(db, [
        { patternHash: "h", description: "d", count: 5 },
      ]);
      const l = getLessonByHash(db, "h");
      expect(l?.source).toBe("dream-wake");
    });

    it("scenario: 3 sessions with same error → 1 lesson with confidence scaled by count", () => {
      const persisted = persistLessonsFromPatterns(db, [
        {
          patternHash: "session-pattern",
          description: "Test failures in auth flow",
          count: 3,
          recommendedAction: "investigate-auth",
        },
      ]);
      expect(persisted).toHaveLength(1);
      expect(persisted[0].confidence).toBeGreaterThanOrEqual(0.5);
      expect(persisted[0].recommendedAction).toBe("investigate-auth");
    });
  });

  describe("consultLessons (D5)", () => {
    beforeEach(() => {
      persistLesson(db, {
        patternHash: "auth1",
        description: "OAuth flow fails on PKCE",
        recommendedAction: "use-pkce",
        confidence: 0.9,
      });
      persistLesson(db, {
        patternHash: "auth2",
        description: "session expiry mid-request",
        recommendedAction: "refresh-token",
        confidence: 0.7,
      });
      persistLesson(db, {
        patternHash: "db1",
        description: "SQLITE_BUSY on parallel writes",
        recommendedAction: "single-writer",
        confidence: 0.8,
      });
    });

    it("returns lessons matching query tokens", () => {
      const matches = consultLessons(db, "oauth pkce");
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].patternHash).toBe("auth1");
    });

    it("orders by confidence DESC", () => {
      const matches = consultLessons(db, "session oauth");
      expect(matches[0].confidence).toBeGreaterThanOrEqual(
        matches[matches.length - 1].confidence,
      );
    });

    it("returns [] when no token matches", () => {
      expect(consultLessons(db, "xyz nonexistent")).toEqual([]);
    });

    it("respects limit", () => {
      const matches = consultLessons(db, "the and oauth pkce session sqlite", 2);
      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it("ignores tokens shorter than 3 chars", () => {
      expect(consultLessons(db, "a is")).toEqual([]);
    });
  });
});
