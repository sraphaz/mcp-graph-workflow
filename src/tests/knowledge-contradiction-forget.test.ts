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
import { applyFeedback } from "../core/rag/knowledge-feedback.js";
import { forgetContradictions } from "../core/rag/knowledge-quality.js";

// Two contradicting docs share enough tokens to land in findContradictions'
// 0.3..0.9 jaccard window AND match a NEGATION_PAIR (must / must not).
const POSITIVE = "The system must enable async writes when the queue is full so back-pressure does not stall the producer side";
const NEGATIVE = "The system must not enable async writes when the queue is full because back-pressure protection requires sync drain";

describe("forgetContradictions — auto-mark older as outdated on contradiction", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  afterEach(() => db.close());

  it("returns zero when there are no contradictions", () => {
    store.insert({ sourceType: "memory", sourceId: "a", title: "A", content: "completely unrelated text about cats and dogs" });
    store.insert({ sourceType: "memory", sourceId: "b", title: "B", content: "another piece of unrelated text about astronomy" });
    const r = forgetContradictions(db);
    expect(r.forgotten).toBe(0);
    expect(r.skippedHigherHelpful).toBe(0);
  });

  it("marks the older doc outdated when contradiction is detected and helpful counts are equal", async () => {
    const older = store.insert({ sourceType: "memory", sourceId: "older", title: "Older claim", content: POSITIVE });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(older.id);
    await new Promise((r) => setTimeout(r, 5));
    const newer = store.insert({ sourceType: "memory", sourceId: "newer", title: "Newer claim", content: NEGATIVE });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-04-30T00:00:00.000Z' WHERE id = ?").run(newer.id);

    const r = forgetContradictions(db);
    expect(r.forgotten).toBeGreaterThanOrEqual(1);

    const olderRow = db.prepare("SELECT staleness_days, quality_score FROM knowledge_documents WHERE id = ?").get(older.id) as { staleness_days: number; quality_score: number };
    expect(olderRow.staleness_days).toBe(999);
    expect(olderRow.quality_score).toBeLessThanOrEqual(0.4);

    // Newer should be untouched.
    const newerRow = db.prepare("SELECT staleness_days FROM knowledge_documents WHERE id = ?").get(newer.id) as { staleness_days: number };
    expect(newerRow.staleness_days).toBe(0);
  });

  it("skips marking when older has more 'helpful' feedback than newer (humans decide)", async () => {
    const older = store.insert({ sourceType: "memory", sourceId: "older", title: "Older trusted", content: POSITIVE });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(older.id);
    await new Promise((r) => setTimeout(r, 5));
    const newer = store.insert({ sourceType: "memory", sourceId: "newer", title: "Newer challenger", content: NEGATIVE });
    db.prepare("UPDATE knowledge_documents SET created_at = '2026-04-30T00:00:00.000Z' WHERE id = ?").run(newer.id);

    // Give older 3 helpful votes — humans rated it useful before; auto-forget should NOT win.
    applyFeedback(db, older.id, "q1", "helpful");
    applyFeedback(db, older.id, "q2", "helpful");
    applyFeedback(db, older.id, "q3", "helpful");

    const r = forgetContradictions(db);
    expect(r.forgotten).toBe(0);
    expect(r.skippedHigherHelpful).toBeGreaterThanOrEqual(1);

    // Older row stays live (staleness not bumped to 999).
    const olderRow = db.prepare("SELECT staleness_days FROM knowledge_documents WHERE id = ?").get(older.id) as { staleness_days: number };
    expect(olderRow.staleness_days).toBeLessThan(999);
  });
});
