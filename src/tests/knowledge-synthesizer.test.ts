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
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { runSynthesisCycle } from "../core/rag/knowledge-synthesizer.js";

describe("Knowledge Synthesizer", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("should synthesize error patterns from AI decisions", () => {
    // Insert multiple AI decisions mentioning similar issues
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:1",
      title: "Decision: Fix auth",
      content: "Error: JWT token expired. Solution: Added refresh token rotation.",
      metadata: { nodeId: "n1", tags: ["auth", "jwt"] },
    });
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:2",
      title: "Decision: Fix session",
      content: "Error: Session timeout issue. Solution: Implemented token refresh mechanism.",
      metadata: { nodeId: "n2", tags: ["auth", "session"] },
    });
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:3",
      title: "Decision: API auth",
      content: "Error: Unauthorized access. Solution: Added proper JWT verification.",
      metadata: { nodeId: "n3", tags: ["auth", "api"] },
    });

    const result = runSynthesisCycle(db);
    expect(result.synthesized).toBeGreaterThanOrEqual(1);

    const synthDocs = store.list({ sourceType: "synthesis" });
    expect(synthDocs.length).toBeGreaterThan(0);
    expect(synthDocs[0].sourceType).toBe("synthesis");
  });

  it("should not re-synthesize existing insights", () => {
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:a",
      title: "Decision A",
      content: "Pattern: database connection pooling is important",
      metadata: { tags: ["database"] },
    });
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:b",
      title: "Decision B",
      content: "Pattern: database query optimization needed",
      metadata: { tags: ["database"] },
    });
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:c",
      title: "Decision C",
      content: "Pattern: database index creation for performance",
      metadata: { tags: ["database"] },
    });

    const first = runSynthesisCycle(db);
    const second = runSynthesisCycle(db);

    // Second run should produce fewer or equal synthesized docs
    expect(second.synthesized).toBeLessThanOrEqual(first.synthesized);
  });

  it("should return zero when insufficient data", () => {
    // Only one decision — not enough to synthesize patterns
    store.insert({
      sourceType: "ai_decision",
      sourceId: "dec:only",
      title: "Single Decision",
      content: "Just one decision, no patterns to find",
      metadata: { tags: ["isolated"] },
    });

    const result = runSynthesisCycle(db);
    expect(result.synthesized).toBe(0);
  });

  it("should synthesize sprint trend insights from multiple sprint plans", () => {
    store.insert({
      sourceType: "sprint_plan",
      sourceId: "sprint:1",
      title: "Sprint 1 Plan",
      content: JSON.stringify({ velocity: 10, capacity: 15, blockers: 2 }),
      metadata: { sprint: "1", velocity: 10, capacity: 15, phase: "PLAN" },
    });
    store.insert({
      sourceType: "sprint_plan",
      sourceId: "sprint:2",
      title: "Sprint 2 Plan",
      content: JSON.stringify({ velocity: 12, capacity: 15, blockers: 1 }),
      metadata: { sprint: "2", velocity: 12, capacity: 15, phase: "PLAN" },
    });
    store.insert({
      sourceType: "sprint_plan",
      sourceId: "sprint:3",
      title: "Sprint 3 Plan",
      content: JSON.stringify({ velocity: 14, capacity: 15, blockers: 0 }),
      metadata: { sprint: "3", velocity: 14, capacity: 15, phase: "PLAN" },
    });

    const result = runSynthesisCycle(db);
    expect(result.synthesized).toBeGreaterThanOrEqual(1);
  });
});
