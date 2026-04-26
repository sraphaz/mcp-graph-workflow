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
import { runRemPhase } from "../core/dream/phases/rem-phase.js";
import { DEFAULT_DREAM_CONFIG } from "../core/dream/dream-types.js";

function insertDoc(
  db: Database.Database,
  id: string,
  metadata: Record<string, unknown> = {},
  qualityScore = 0.5,
): void {
  const ts = new Date().toISOString();
  db.prepare(
    `INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, metadata, quality_score, created_at, updated_at)
     VALUES (?, 'memory', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    `src-${id}`,
    `Doc ${id}`,
    "content",
    `hash-${id}`,
    JSON.stringify(metadata),
    qualityScore,
    ts,
    ts,
  );
}

describe("runRemPhase", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should return shape { priorityProcessed, urgencyDecayed, merged, clustersFormed, associationsCreated, durationMs }", () => {
    const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");

    expect(result).toHaveProperty("priorityProcessed");
    expect(result).toHaveProperty("urgencyDecayed");
    expect(result).toHaveProperty("merged");
    expect(result).toHaveProperty("clustersFormed");
    expect(result).toHaveProperty("associationsCreated");
    expect(result).toHaveProperty("durationMs");
  });

  it("should produce zero counts on an empty store", () => {
    const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");

    expect(result.priorityProcessed).toBe(0);
    expect(result.merged).toBe(0);
    expect(result.clustersFormed).toBe(0);
    expect(result.associationsCreated).toBe(0);
  });

  it("should report durationMs as a non-negative number", () => {
    const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should not throw when run without an embeddingProvider (semantic merge disabled)", () => {
    insertDoc(db, "d1");
    insertDoc(db, "d2");

    expect(() => runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1")).not.toThrow();
  });

  it("should not throw when run with empty embeddingProvider", () => {
    insertDoc(db, "d1");

    const provider = {
      count: () => 0,
      findSimilar: () => [],
      getById: () => null,
      getAllIds: () => [],
    };

    expect(() => runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1", provider)).not.toThrow();
  });

  it("should respect dryRun=true (no destructive changes)", () => {
    insertDoc(db, "d1");
    insertDoc(db, "d2");

    const before = db
      .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents")
      .get() as { cnt: number };

    runRemPhase(db, { ...DEFAULT_DREAM_CONFIG, dryRun: true }, "cycle-1");

    const after = db
      .prepare("SELECT COUNT(*) as cnt FROM knowledge_documents")
      .get() as { cnt: number };

    // dryRun must not delete docs.
    expect(after.cnt).toBe(before.cnt);
  });

  it("should be safe to invoke twice in sequence on the same DB", () => {
    insertDoc(db, "d1");

    expect(() => {
      runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-1");
      runRemPhase(db, DEFAULT_DREAM_CONFIG, "cycle-2");
    }).not.toThrow();
  });
});
