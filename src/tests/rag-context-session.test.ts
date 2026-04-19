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
import { applyRagSessionDelta } from "../core/context/context-session.js";

describe("rag_context + session integration", () => {
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

  describe("applyRagSessionDelta", () => {
    it("should return full response on first call with sessionId", () => {
      const response = {
        query: "test query",
        sections: [
          { name: "node:Task1", source: "graph", content: "Task 1 context data", tokens: 50 },
          { name: "node:Task2", source: "graph", content: "Task 2 context data", tokens: 40 },
        ],
        tokenUsage: { budget: 4000, used: 90, remaining: 3910 },
      };

      const result = applyRagSessionDelta(tracker, "sess1", response);

      expect(result.response).toEqual(response);
      expect(result._session_savings.skippedCount).toBe(0);
      expect(result._session_savings.tokensSaved).toBe(0);
    });

    it("should show savings on second call with same response", () => {
      const response = {
        query: "test query",
        sections: [
          { name: "node:Task1", source: "graph", content: "Task 1 context data", tokens: 50 },
          { name: "node:Task2", source: "graph", content: "Task 2 context data", tokens: 40 },
        ],
        tokenUsage: { budget: 4000, used: 90, remaining: 3910 },
      };

      // First call
      applyRagSessionDelta(tracker, "sess1", response);

      // Second call — same data, should show savings
      const second = applyRagSessionDelta(tracker, "sess1", response);
      expect(second._session_savings.skippedCount).toBeGreaterThan(0);
      expect(second._session_savings.tokensSaved).toBeGreaterThan(0);
    });

    it("should handle response without sections gracefully", () => {
      const response = {
        query: "test",
        results: [{ id: "r1", title: "Result 1", content: "Some content" }],
      };

      const result = applyRagSessionDelta(tracker, "sess1", response);

      expect(result._session_savings.skippedCount).toBe(0);
      expect(result._session_savings.tokensSaved).toBe(0);
    });

    it("should track results array as chunks when sections absent", () => {
      const response = {
        query: "test",
        results: [
          { id: "r1", title: "Result 1", content: "Content A" },
          { id: "r2", title: "Result 2", content: "Content B" },
        ],
      };

      // First call
      applyRagSessionDelta(tracker, "sess1", response);

      // Second call — results should be recognized as seen
      const second = applyRagSessionDelta(tracker, "sess1", response);
      expect(second._session_savings.skippedCount).toBeGreaterThan(0);
    });

    it("should return correct _session_savings shape", () => {
      const response = { query: "test" };

      const result = applyRagSessionDelta(tracker, "sess1", response);

      expect(result._session_savings).toHaveProperty("skippedCount");
      expect(result._session_savings).toHaveProperty("tokensSaved");
      expect(typeof result._session_savings.skippedCount).toBe("number");
      expect(typeof result._session_savings.tokensSaved).toBe("number");
    });
  });
});
