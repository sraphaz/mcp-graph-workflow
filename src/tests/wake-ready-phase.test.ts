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
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { runWakeReadyPhase } from "../core/dream/phases/wake-ready-phase.js";

describe("runWakeReadyPhase", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should return shape { freedTokens, signalToNoise, newGeneralizations, durationMs }", () => {
    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 0,
      avgQualityBefore: 0,
    });

    expect(result).toHaveProperty("freedTokens");
    expect(result).toHaveProperty("signalToNoise");
    expect(result).toHaveProperty("newGeneralizations");
    expect(result).toHaveProperty("durationMs");
    expect(typeof result.freedTokens).toBe("number");
    expect(typeof result.signalToNoise).toBe("number");
    expect(typeof result.newGeneralizations).toBe("number");
    expect(typeof result.durationMs).toBe("number");
  });

  it("should report 0 freedTokens when no docs were removed", () => {
    // Insert 5 docs, before count says 5 → no removal happened.
    for (let i = 0; i < 5; i++) {
      const ts = new Date().toISOString();
      db.prepare(
        `INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, metadata, created_at, updated_at)
         VALUES (?, 'memory', ?, ?, ?, ?, '{}', ?, ?)`,
      ).run(`d${i}`, `src${i}`, `Doc ${i}`, "content", `hash${i}`, ts, ts);
    }

    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 5,
      avgQualityBefore: 0.5,
    });

    expect(result.freedTokens).toBe(0);
  });

  it("should compute positive freedTokens when docs were removed (before > current)", () => {
    // Insert 2 docs but report 10 as the before count → 8 removed.
    for (let i = 0; i < 2; i++) {
      const ts = new Date().toISOString();
      db.prepare(
        `INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, metadata, created_at, updated_at)
         VALUES (?, 'memory', ?, ?, ?, ?, '{}', ?, ?)`,
      ).run(`d${i}`, `src${i}`, `Doc ${i}`, "x".repeat(500), `hash${i}`, ts, ts);
    }

    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 10,
      avgQualityBefore: 0.5,
    });

    expect(result.freedTokens).toBeGreaterThan(0);
  });

  it("should clamp negative removal counts to zero (current > before edge)", () => {
    for (let i = 0; i < 5; i++) {
      const ts = new Date().toISOString();
      db.prepare(
        `INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, metadata, created_at, updated_at)
         VALUES (?, 'memory', ?, ?, ?, ?, '{}', ?, ?)`,
      ).run(`d${i}`, `src${i}`, `Doc ${i}`, "content", `hash${i}`, ts, ts);
    }

    // Before count of 0 means current (5) > before (0) → math.max clamp.
    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 0,
      avgQualityBefore: 0.5,
    });

    expect(result.freedTokens).toBe(0);
  });

  it("should compute signalToNoise as ratio after/before when both > 0", () => {
    const ts = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, metadata, quality_score, created_at, updated_at)
       VALUES ('d1', 'memory', 'x', 't', 'c', 'h', '{}', 0.8, ?, ?)`,
    ).run(ts, ts);

    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 1,
      avgQualityBefore: 0.4,
    });

    // current avg = 0.8, before = 0.4 → ratio 2.0
    expect(result.signalToNoise).toBeCloseTo(2.0, 1);
  });

  it("should report signalToNoise=0 when before quality is 0 (no signal)", () => {
    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 0,
      avgQualityBefore: 0,
    });

    expect(result.signalToNoise).toBe(0);
  });

  it("should never throw on empty store", () => {
    expect(() =>
      runWakeReadyPhase(db, { totalDocsBefore: 0, avgQualityBefore: 0 }),
    ).not.toThrow();
  });

  it("should report durationMs as a non-negative number", () => {
    const result = runWakeReadyPhase(db, {
      totalDocsBefore: 0,
      avgQualityBefore: 0,
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
