/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JourneyRunsStore } from "../core/journey/journey-runs-store.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE journey_runs (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      variant_id TEXT,
      node_id TEXT,
      prompt TEXT,
      plan TEXT NOT NULL,
      results TEXT NOT NULL DEFAULT '[]',
      verdict TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER
    );
  `);
  return db;
}

describe("JourneyRunsStore", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "journey-runs-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("creates a run and reads it back", () => {
    // Arrange
    const db = freshDb();
    const store = new JourneyRunsStore(db, root);

    // Act
    const run = store.create({
      mapId: "jmap_1",
      variantId: "jvar_a",
      nodeId: null,
      prompt: "open landing",
      plan: [{ index: 0, screenId: "s1", helper: "navigate", args: { url: "https://x" } }],
      results: [],
      verdict: "running",
      durationMs: 0,
    });

    // Assert
    expect(run.id).toMatch(/^jrun_/);
    expect(run.mapId).toBe("jmap_1");
    expect(run.verdict).toBe("running");
    expect(store.get(run.id)?.prompt).toBe("open landing");
  });

  it("lists most-recent runs first, filters by mapId", () => {
    // Arrange
    const db = freshDb();
    const store = new JourneyRunsStore(db, root);

    // Act
    store.create({ mapId: "A", variantId: null, nodeId: null, prompt: null, plan: [], results: [], verdict: "pass", durationMs: 10 });
    store.create({ mapId: "B", variantId: null, nodeId: null, prompt: null, plan: [], results: [], verdict: "fail", durationMs: 20 });
    store.create({ mapId: "A", variantId: null, nodeId: null, prompt: null, plan: [], results: [], verdict: "pass", durationMs: 30 });

    const listAll = store.list();
    const listA = store.list({ mapId: "A" });

    // Assert
    expect(listAll).toHaveLength(3);
    expect(listA).toHaveLength(2);
    expect(listA.every((r) => r.mapId === "A")).toBe(true);
  });

  it("saves and loads step screenshots", () => {
    // Arrange
    const db = freshDb();
    const store = new JourneyRunsStore(db, root);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const run = store.create({
      mapId: "jmap_1", variantId: null, nodeId: null, prompt: null,
      plan: [], results: [], verdict: "running", durationMs: 0,
    });

    // Act
    const rel = store.saveScreenshot(run.id, 0, png);
    const loaded = store.loadScreenshot(run.id, 0);

    // Assert
    expect(rel).toMatch(/journeys\/screenshots/);
    expect(loaded).toEqual(png);
  });

  it("finalise() persists results, verdict, finishedAt", () => {
    // Arrange
    const db = freshDb();
    const store = new JourneyRunsStore(db, root);
    const run = store.create({
      mapId: "jmap_1", variantId: null, nodeId: null, prompt: null,
      plan: [{ index: 0, screenId: "s1", helper: "screenshot", args: {} }],
      results: [], verdict: "running", durationMs: 0,
    });

    // Act
    store.finalise(run.id, {
      results: [{
        index: 0, screenId: "s1", helper: "screenshot", args: {},
        ok: true, durationMs: 12, screenshotPath: "p/0.png", ocrText: null, domText: null, error: null,
      }],
      verdict: "pass",
      durationMs: 12,
    });

    // Assert
    const after = store.get(run.id);
    expect(after?.verdict).toBe("pass");
    expect(after?.results[0].ok).toBe(true);
    expect(after?.finishedAt).not.toBeNull();
  });
});
