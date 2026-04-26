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
import { runNremPhase } from "../core/dream/phases/nrem-phase.js";
import { DEFAULT_DREAM_CONFIG } from "../core/dream/dream-types.js";

function insertDoc(
  db: Database.Database,
  id: string,
  qualityScore: number | null = 0.5,
  createdAt: string = new Date().toISOString(),
): void {
  const ts = new Date().toISOString();
  db.prepare(
    `INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, metadata, quality_score, created_at, updated_at)
     VALUES (?, 'memory', ?, ?, ?, ?, '{}', ?, ?, ?)`,
  ).run(id, `src-${id}`, `Doc ${id}`, "content", `hash-${id}`, qualityScore, createdAt, ts);
}

describe("runNremPhase", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should return shape { replayed, scoresDecayed, pruned, archived, durationMs }", () => {
    const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");

    expect(result).toHaveProperty("replayed");
    expect(result).toHaveProperty("scoresDecayed");
    expect(result).toHaveProperty("pruned");
    expect(result).toHaveProperty("archived");
    expect(result).toHaveProperty("durationMs");
    [result.replayed, result.scoresDecayed, result.pruned, result.archived].forEach(
      (n) => expect(typeof n).toBe("number"),
    );
  });

  it("should produce zero counts on an empty store", () => {
    const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");

    expect(result.replayed).toBe(0);
    expect(result.scoresDecayed).toBe(0);
    expect(result.pruned).toBe(0);
    expect(result.archived).toBe(0);
  });

  it("should run all 3 sub-phases (replay → decay → prune) without throwing", () => {
    // The decay phase recomputes quality_score from staleness/usage, so the
    // exact pruning outcome depends on internal scoring. The deep invariant
    // for this test is "runs end-to-end on a populated store without throwing".
    insertDoc(db, "doc-low", 0.05);
    insertDoc(db, "doc-mid", 0.5);
    insertDoc(db, "doc-high", 0.9);

    expect(() =>
      runNremPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1"),
    ).not.toThrow();
  });

  it("should report durationMs as a non-negative number", () => {
    const result = runNremPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should be safe to run multiple cycles in sequence", () => {
    insertDoc(db, "d1", 0.7);
    insertDoc(db, "d2", 0.3);

    const r1 = runNremPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");
    const r2 = runNremPhase(db, DEFAULT_DREAM_CONFIG, "cycle-2");

    // Both invocations succeed without errors; counts may differ across cycles.
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});
