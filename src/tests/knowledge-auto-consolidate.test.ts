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
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { consolidateDuplicates } from "../core/rag/knowledge-quality.js";

// Token set with high overlap: 18 unique tokens. Variant adds "addendum"
// → 18 / 19 = 0.94 Jaccard, comfortably above the 0.7 threshold.
const BASE = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma";
const VARIANT = `${BASE} addendum`;

describe("consolidateDuplicates — auto-consolidation of near-duplicate memories", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  afterEach(() => db.close());

  it("returns zero consolidations when there are no near-duplicate pairs", () => {
    store.insert({ sourceType: "memory", sourceId: "alpha", title: "Alpha", content: "completely different content about cats" });
    store.insert({ sourceType: "memory", sourceId: "beta", title: "Beta", content: "wholly unrelated text about astronomy and stars" });
    const r = consolidateDuplicates(db);
    expect(r.consolidated).toBe(0);
  });

  it("consolidates a near-duplicate pair: older becomes archived (staleness=999, quality floored)", async () => {
    const older = store.insert({ sourceType: "memory", sourceId: "older", title: "Older", content: BASE });
    // Force a different created_at so survivor selection is unambiguous.
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(older.id);
    await new Promise((r) => setTimeout(r, 5));
    const newer = store.insert({ sourceType: "memory", sourceId: "newer", title: "Newer", content: VARIANT });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-04-30T00:00:00.000Z' WHERE id = ?").run(newer.id);

    const r = consolidateDuplicates(db);
    expect(r.consolidated).toBe(1);

    const loserRow = db.prepare("SELECT staleness_days, quality_score, metadata FROM knowledge_documents WHERE id = ?").get(older.id) as { staleness_days: number; quality_score: number; metadata: string | null };
    expect(loserRow.staleness_days).toBe(999);
    expect(loserRow.quality_score).toBeLessThanOrEqual(0.1);
    const loserMeta = JSON.parse(loserRow.metadata ?? "{}");
    expect(loserMeta.consolidatedInto).toBe(newer.id);

    const survivorRow = db.prepare("SELECT metadata FROM knowledge_documents WHERE id = ?").get(newer.id) as { metadata: string | null };
    const survivorMeta = JSON.parse(survivorRow.metadata ?? "{}");
    expect(Array.isArray(survivorMeta.consolidatedFrom)).toBe(true);
    expect(survivorMeta.consolidatedFrom).toContain(older.id);
  });

  it("is idempotent on a second pass (no double-archive)", async () => {
    const older = store.insert({ sourceType: "memory", sourceId: "o", title: "O", content: BASE });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(older.id);
    await new Promise((r) => setTimeout(r, 5));
    const newer = store.insert({ sourceType: "memory", sourceId: "n", title: "N", content: BASE + " more" });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-04-30T00:00:00.000Z' WHERE id = ?").run(newer.id);

    const first = consolidateDuplicates(db);
    expect(first.consolidated).toBe(1);
    const second = consolidateDuplicates(db);
    expect(second.consolidated).toBe(0);
  });
});
