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
import { SessionTracker } from "../core/context/session-tracker.js";
import type { TaskContext } from "../core/context/compact-context.js";
import {
  applySessionDelta,

} from "../core/context/context-session.js";

function makeFakeContext(overrides?: Partial<TaskContext>): TaskContext {
  return {
    task: { id: "node1", type: "task", title: "Test Task", status: "done", priority: 2 },
    node: { id: "node1", type: "task", title: "Test Task", status: "done", priority: 2 },
    parent: { id: "epic1", type: "epic", title: "Parent Epic", status: "backlog", priority: 1 },
    children: [{ id: "sub1", type: "subtask", title: "Child", status: "backlog", priority: 3 }],
    blockers: [],
    dependsOn: [{ id: "dep1", title: "Dep", status: "done", resolved: true, inferred: false }],
    acceptanceCriteria: ["AC1: should handle the case", "AC2: should validate output"],
    sourceRef: { file: "src/test.ts", startLine: 1, endLine: 10, confidence: 0.9 },
    metrics: { originalChars: 500, compactChars: 200, reductionPercent: 60, estimatedTokens: 50 },
    ...overrides,
  } as TaskContext;
}

describe("context + session integration", () => {
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

  describe("applySessionDelta", () => {
    it("should return full context on first call with sessionId", () => {
      const ctx = makeFakeContext();

      const result = applySessionDelta(tracker, "sess1", ctx);

      expect(result.context).toBeDefined();
      expect(result._session_savings.skippedCount).toBe(0);
      expect(result._session_savings.tokensSaved).toBe(0);
    });

    it("should return fewer tokens on second call with same sessionId", () => {
      const ctx = makeFakeContext();

      // First call — registers all chunks
      const first = applySessionDelta(tracker, "sess1", ctx);
      expect(first._session_savings.skippedCount).toBe(0);

      // Second call with same context — all chunks already seen
      const second = applySessionDelta(tracker, "sess1", ctx);
      expect(second._session_savings.skippedCount).toBeGreaterThan(0);
      expect(second._session_savings.tokensSaved).toBeGreaterThan(0);
    });

    it("should return _session_savings with correct shape", () => {
      const ctx = makeFakeContext({ parent: null, children: [], dependsOn: [], acceptanceCriteria: [], sourceRef: null });

      const result = applySessionDelta(tracker, "sess1", ctx);

      expect(result._session_savings).toHaveProperty("skippedCount");
      expect(result._session_savings).toHaveProperty("tokensSaved");
      expect(typeof result._session_savings.skippedCount).toBe("number");
      expect(typeof result._session_savings.tokensSaved).toBe("number");
    });
  });
});
