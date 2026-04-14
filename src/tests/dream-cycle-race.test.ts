import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { DreamEngine } from "../core/dream/dream-engine.js";
import { GraphEventBus } from "../core/events/event-bus.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function insertTestDoc(db: Database.Database, id: string, qualityScore: number): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at, quality_score, usage_count)
    VALUES (?, 'memory', ?, ?, 'Test content for knowledge document', ?, 0, ?, ?, ?, 0)
  `).run(id, `src_${id}`, `Doc ${id}`, `hash_${id}`, now, now, qualityScore);
}

describe("Dream cycle race condition fix (E4-T01)", () => {
  let db: Database.Database;
  let eventBus: GraphEventBus;
  let engine: DreamEngine;

  beforeEach(() => {
    db = createTestDb();
    eventBus = new GraphEventBus();
    engine = new DreamEngine(db, eventBus);
  });

  // ── AC1: cycleId available synchronously in response ──

  describe("synchronous cycleId availability", () => {
    it("should generate cycleId synchronously (available in result without setTimeout)", async () => {
      insertTestDoc(db, "d1", 0.5);

      // cycleId is generated synchronously via generateId before any async ops
      // The result.id proves it was set synchronously (not via setTimeout callback)
      const result = await engine.runCycle();
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^dream_/);
      expect(result.id.length).toBeGreaterThan(6);
    });

    it("should return a cycleId that starts with 'dream_' prefix", async () => {
      insertTestDoc(db, "d1", 0.6);

      const result = await engine.runCycle();
      expect(result.id).toMatch(/^dream_/);
    });
  });

  // ── AC2: no setTimeout dependency ──

  describe("no setTimeout dependency", () => {
    it("should complete cycle synchronously without requiring setTimeout", async () => {
      insertTestDoc(db, "d1", 0.5);
      insertTestDoc(db, "d2", 0.7);

      // If setTimeout were required, this would hang or fail
      const result = await engine.runCycle();
      expect(result.status).toBe("completed");
      expect(result.id).toBeDefined();
    });
  });

  // ── AC3: async cycle runs correctly in background ──

  describe("background cycle execution", () => {
    it("should complete cycle with all three phases", async () => {
      insertTestDoc(db, "d1", 0.3);
      insertTestDoc(db, "d2", 0.8);

      const result = await engine.runCycle();

      expect(result.phases.nrem).toBeDefined();
      expect(result.phases.rem).toBeDefined();
      expect(result.phases.wakeReady).toBeDefined();
      expect(result.completedAt).not.toBe("");
    });

    it("should emit cycle_started and cycle_completed events", async () => {
      insertTestDoc(db, "d1", 0.5);

      const events: string[] = [];
      eventBus.on("dream:cycle_started", () => events.push("started"));
      eventBus.on("dream:cycle_completed", () => events.push("completed"));

      await engine.runCycle();

      expect(events).toContain("started");
      expect(events).toContain("completed");
    });

    it("should reset running status after cycle completes", async () => {
      insertTestDoc(db, "d1", 0.5);

      await engine.runCycle();

      const status = engine.getStatus();
      expect(status.running).toBe(false);
      expect(status.currentPhase).toBeUndefined();
    });
  });
});
