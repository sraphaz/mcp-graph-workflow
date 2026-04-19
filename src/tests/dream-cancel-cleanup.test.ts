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

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { DreamEngine } from "../core/dream/dream-engine.js";
import { getDreamCycle } from "../core/dream/dream-store.js";
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

describe("Dream cycle cancel cleanup (E13-T05)", () => {
  let db: Database.Database;
  let eventBus: GraphEventBus;
  let engine: DreamEngine;

  beforeEach(() => {
    db = createTestDb();
    eventBus = new GraphEventBus();
    engine = new DreamEngine(db, eventBus);
  });

  // ── AC1: finally block does complete cleanup ──

  describe("cleanup on cancel", () => {
    it("should persist cancelled status to DB when cycle is cancelled mid-phase", async () => {
      insertTestDoc(db, "d1", 0.5);

      // Cancel after NREM phase completes (between phases)
      eventBus.on("dream:phase_completed", (evt) => {
        if ((evt.payload as Record<string, unknown>).phase === "nrem") {
          engine.cancelCycle();
        }
      });

      const result = await engine.runCycle();

      expect(result.status).toBe("cancelled");

      // DB should have the cancelled record
      const dbCycle = getDreamCycle(db, result.id);
      expect(dbCycle).toBeDefined();
      expect(dbCycle!.status).toBe("cancelled");
    });

    it("should reset engine state after cancel", async () => {
      insertTestDoc(db, "d1", 0.5);

      engine.cancelCycle();
      await engine.runCycle();

      const status = engine.getStatus();
      expect(status.running).toBe(false);
      expect(status.currentPhase).toBeUndefined();
      expect(status.cycleId).toBeUndefined();
    });
  });

  // ── AC2: Emit event dream:cycle_cancelled ──

  describe("cancelled event emission", () => {
    it("should emit dream:cycle_cancelled event when cycle is cancelled", async () => {
      insertTestDoc(db, "d1", 0.5);

      const cancelledEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
      eventBus.on("dream:cycle_cancelled", (evt) => {
        cancelledEvents.push({ type: evt.type, payload: evt.payload as Record<string, unknown> });
      });

      // Cancel after NREM
      eventBus.on("dream:phase_completed", (evt) => {
        if ((evt.payload as Record<string, unknown>).phase === "nrem") {
          engine.cancelCycle();
        }
      });

      const result = await engine.runCycle();

      expect(result.status).toBe("cancelled");
      expect(cancelledEvents).toHaveLength(1);
      expect(cancelledEvents[0].type).toBe("dream:cycle_cancelled");
      expect(cancelledEvents[0].payload.cycleId).toBe(result.id);
    });

    it("should NOT emit dream:cycle_completed when cancelled", async () => {
      insertTestDoc(db, "d1", 0.5);

      let completedEmitted = false;
      eventBus.on("dream:cycle_completed", () => { completedEmitted = true; });

      // Cancel after NREM
      eventBus.on("dream:phase_completed", (evt) => {
        if ((evt.payload as Record<string, unknown>).phase === "nrem") {
          engine.cancelCycle();
        }
      });

      await engine.runCycle();

      expect(completedEmitted).toBe(false);
    });
  });

  // ── AC3: cancel mid-phase test ──

  describe("cancel mid-phase", () => {
    it("should stop after nrem phase when cancelled between phases", async () => {
      insertTestDoc(db, "d1", 0.5);
      insertTestDoc(db, "d2", 0.7);

      // Register listener to cancel after NREM completes
      eventBus.on("dream:phase_completed", (evt) => {
        if ((evt.payload as Record<string, unknown>).phase === "nrem") {
          engine.cancelCycle();
        }
      });

      const result = await engine.runCycle();

      expect(result.status).toBe("cancelled");
      // NREM phase should have results, but cycle stopped
      expect(result.phases.nrem.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
