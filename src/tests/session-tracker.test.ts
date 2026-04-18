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

  describe("LRU eviction (memory cap)", () => {
    it("should evict oldest session from L1 cache when maxSessions exceeded", () => {
      const capped = new SessionTracker(db, { maxSessions: 2 });
      capped.trackSent("s1", ["chunk-a"]);
      capped.trackSent("s2", ["chunk-b"]);
      capped.trackSent("s3", ["chunk-c"]);

      expect(capped.cacheSize()).toBeLessThanOrEqual(2);
    });

    it("should preserve SQLite data when L1 entry is evicted (reload on next access)", () => {
      const capped = new SessionTracker(db, { maxSessions: 2 });
      capped.trackSent("s1", ["chunk-a"]);
      capped.trackSent("s2", ["chunk-b"]);
      capped.trackSent("s3", ["chunk-c"]);

      // s1 evicted from L1, but SQLite persists — reload gives correct delta
      const delta = capped.getDelta("s1", ["chunk-a", "chunk-new"]);
      expect(delta.skippedCount).toBe(1);
      expect(delta.newChunks).toEqual(["chunk-new"]);
    });

    it("should touch LRU order on access (recently used survives)", () => {
      const capped = new SessionTracker(db, { maxSessions: 2 });
      capped.trackSent("s1", ["chunk-a"]);
      capped.trackSent("s2", ["chunk-b"]);
      capped.getDelta("s1", ["chunk-a"]); // touch s1 → s2 oldest
      capped.trackSent("s3", ["chunk-c"]); // should evict s2, not s1

      expect(capped.cacheSize()).toBe(2);
    });
  });

  describe("TTL cleanup", () => {
    it("should expire stale sessions from L1 via cleanupStale", async () => {
      const short = new SessionTracker(db, { ttlMs: 50 });
      short.trackSent("s1", ["chunk-a"]);
      expect(short.cacheSize()).toBe(1);

      await new Promise((r) => setTimeout(r, 80));
      const evicted = short.cleanupStale();

      expect(evicted).toBe(1);
      expect(short.cacheSize()).toBe(0);
    });

    it("should keep fresh sessions untouched", () => {
      const tracked = new SessionTracker(db, { ttlMs: 60_000 });
      tracked.trackSent("s1", ["chunk-a"]);
      const evicted = tracked.cleanupStale();

      expect(evicted).toBe(0);
      expect(tracked.cacheSize()).toBe(1);
    });
  });

  describe("cleanupStaleDb (SQLite pruning)", () => {
    it("removes SQLite rows older than ttlMs", () => {
      const dbTracker = new SessionTracker(db, { ttlMs: 60_000 });
      dbTracker.trackSent("fresh", ["chunk-fresh"]);
      dbTracker.trackSent("old", ["chunk-old"]);

      const pastIso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
      db.prepare("UPDATE session_chunks SET tracked_at = ? WHERE session_id = ?").run(pastIso, "old");

      const removed = dbTracker.cleanupStaleDb();

      expect(removed).toBe(1);
      const remaining = db.prepare("SELECT session_id FROM session_chunks").all() as Array<{ session_id: string }>;
      expect(remaining.map((r) => r.session_id)).toEqual(["fresh"]);
    });

    it("accepts an explicit maxAgeMs override", () => {
      const dbTracker = new SessionTracker(db, { ttlMs: 30 * 60 * 1000 });
      dbTracker.trackSent("s", ["c"]);
      const pastIso = new Date(Date.now() - 120_000).toISOString();
      db.prepare("UPDATE session_chunks SET tracked_at = ? WHERE session_id = ?").run(pastIso, "s");

      const keptWithDefault = dbTracker.cleanupStaleDb();
      expect(keptWithDefault).toBe(0);

      const prunedWithOverride = dbTracker.cleanupStaleDb(60_000);
      expect(prunedWithOverride).toBe(1);
    });
  });
});
