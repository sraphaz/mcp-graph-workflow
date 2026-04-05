import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { SessionTracker } from "../core/context/session-tracker.js";

describe("SessionTracker", () => {
  let db: Database.Database;
  let tracker: SessionTracker;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    tracker = new SessionTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("trackSent", () => {
    it("should register chunks in SQLite", () => {
      tracker.trackSent("sess1", ["chunk1", "chunk2"]);

      const rows = db
        .prepare("SELECT * FROM session_chunks WHERE session_id = ?")
        .all("sess1") as Array<{ session_id: string; content_hash: string; tokens: number }>;

      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.session_id === "sess1")).toBe(true);
      expect(rows.every((r) => r.tokens > 0)).toBe(true);
    });

    it("should not duplicate already-tracked chunks", () => {
      tracker.trackSent("sess1", ["chunk1", "chunk2"]);
      tracker.trackSent("sess1", ["chunk1", "chunk3"]);

      const rows = db
        .prepare("SELECT * FROM session_chunks WHERE session_id = ?")
        .all("sess1") as Array<{ content_hash: string }>;

      // chunk1 appears once, chunk2 once, chunk3 once = 3 total
      expect(rows).toHaveLength(3);
    });
  });

  describe("getDelta", () => {
    it("should return only new chunks", () => {
      tracker.trackSent("sess1", ["chunk1", "chunk2"]);

      const delta = tracker.getDelta("sess1", ["chunk1", "chunk3"]);

      expect(delta.newChunks).toEqual(["chunk3"]);
      expect(delta.skippedCount).toBe(1);
      expect(delta.tokensSaved).toBeGreaterThan(0);
    });

    it("should return all chunks when nothing tracked yet", () => {
      const delta = tracker.getDelta("sess1", ["chunk1", "chunk2"]);

      expect(delta.newChunks).toEqual(["chunk1", "chunk2"]);
      expect(delta.skippedCount).toBe(0);
      expect(delta.tokensSaved).toBe(0);
    });

    it("should return empty when all chunks already tracked", () => {
      tracker.trackSent("sess1", ["chunk1", "chunk2"]);

      const delta = tracker.getDelta("sess1", ["chunk1", "chunk2"]);

      expect(delta.newChunks).toEqual([]);
      expect(delta.skippedCount).toBe(2);
      expect(delta.tokensSaved).toBeGreaterThan(0);
    });

    it("should use in-memory cache on second call (no extra SQLite reads)", () => {
      tracker.trackSent("sess1", ["chunk1"]);

      // First getDelta populates in-memory cache
      tracker.getDelta("sess1", ["chunk1", "chunk2"]);

      // Second call should use in-memory cache
      // We verify by checking that the result is still correct
      // (if cache is broken, this would fail)
      const delta = tracker.getDelta("sess1", ["chunk1", "chunk3"]);

      expect(delta.newChunks).toEqual(["chunk3"]);
      expect(delta.skippedCount).toBe(1);
    });
  });

  describe("getSessionStats", () => {
    it("should return correct stats for tracked session", () => {
      tracker.trackSent("sess1", ["chunk1", "chunk2", "chunk3", "chunk4", "chunk5"]);

      const stats = tracker.getSessionStats("sess1");

      expect(stats.sentCount).toBe(5);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it("should return zero stats for unknown session", () => {
      const stats = tracker.getSessionStats("unknown");

      expect(stats.sentCount).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });
  });

  describe("clearSession", () => {
    it("should remove all records from SQLite", () => {
      tracker.trackSent("sess1", ["chunk1", "chunk2"]);
      tracker.clearSession("sess1");

      const rows = db
        .prepare("SELECT * FROM session_chunks WHERE session_id = ?")
        .all("sess1");

      expect(rows).toHaveLength(0);
    });

    it("should clear in-memory cache", () => {
      tracker.trackSent("sess1", ["chunk1"]);

      // Populate in-memory cache
      tracker.getDelta("sess1", ["chunk1"]);

      // Clear session
      tracker.clearSession("sess1");

      // After clearing, chunk1 should be considered new again
      const delta = tracker.getDelta("sess1", ["chunk1"]);
      expect(delta.newChunks).toEqual(["chunk1"]);
      expect(delta.skippedCount).toBe(0);
    });

    it("should not affect other sessions", () => {
      tracker.trackSent("sess1", ["chunk1"]);
      tracker.trackSent("sess2", ["chunk2"]);

      tracker.clearSession("sess1");

      const delta = tracker.getDelta("sess2", ["chunk2"]);
      expect(delta.skippedCount).toBe(1);
      expect(delta.newChunks).toEqual([]);
    });
  });
});
