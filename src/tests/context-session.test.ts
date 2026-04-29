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
import {
  applySessionDelta,
  applyRagSessionDelta,
} from "../core/context/context-session.js";
import { SessionTracker } from "../core/context/session-tracker.js";
import type { TaskContext } from "../core/context/compact-context.js";

function makeContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    task: {
      id: "task-1",
      type: "task",
      title: "Test Task",
      status: "backlog",
      priority: 3,
    },
    node: {
      id: "task-1",
      type: "task",
      title: "Test Task",
      status: "backlog",
      priority: 3,
    },
    parent: null,
    children: [],
    blockers: [],
    dependsOn: [],
    acceptanceCriteria: [],
    sourceRef: null,
    metrics: {
      originalChars: 0,
      compactChars: 0,
      reductionPercent: 0,
      estimatedTokens: 0,
    },
    ...overrides,
  } as TaskContext;
}

describe("applySessionDelta", () => {
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

  it("should return the original context wrapped with _session_savings field", () => {
    const ctx = makeContext();
    const result = applySessionDelta(tracker, "session-1", ctx);

    expect(result.context).toBeDefined();
    expect(result.context.task.id).toBe("task-1");
    expect(result._session_savings).toBeDefined();
    expect(typeof result._session_savings.skippedCount).toBe("number");
    expect(typeof result._session_savings.tokensSaved).toBe("number");
  });

  it("should report skippedCount=0 on first call (all chunks are new)", () => {
    const ctx = makeContext();
    const result = applySessionDelta(tracker, "session-fresh", ctx);

    expect(result._session_savings.skippedCount).toBe(0);
    expect(result._session_savings.tokensSaved).toBe(0);
  });

  it("should report skippedCount > 0 on second identical call (delta picks up sent chunks)", () => {
    const ctx = makeContext();

    applySessionDelta(tracker, "s2", ctx);
    const second = applySessionDelta(tracker, "s2", ctx);

    expect(second._session_savings.skippedCount).toBeGreaterThan(0);
    expect(second._session_savings.tokensSaved).toBeGreaterThan(0);
  });

  it("should isolate chunks per sessionId (different sessions don't share)", () => {
    const ctx = makeContext();

    applySessionDelta(tracker, "s-a", ctx);
    const otherSession = applySessionDelta(tracker, "s-b", ctx);

    // Different sessionId = no chunks sent yet for that session.
    expect(otherSession._session_savings.skippedCount).toBe(0);
  });

  it("should detect new chunks when context changes between calls (e.g. children added)", () => {
    const baseline = makeContext();
    applySessionDelta(tracker, "s-c", baseline);

    const updated = makeContext({
      children: [
        {
          id: "child-1",
          type: "task",
          title: "Child A",
          status: "backlog",
          priority: 3,
        },
      ],
    });
    const second = applySessionDelta(tracker, "s-c", updated);

    // Some chunks are reused (task), some new (children).
    // → skippedCount > 0 (task was already sent) AND tokensSaved > 0.
    expect(second._session_savings.skippedCount).toBeGreaterThan(0);
  });
});

describe("applyRagSessionDelta", () => {
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

  it("should wrap a RAG response with _session_savings", () => {
    const response = { results: [{ docId: "d1", title: "doc 1" }] };
    const result = applyRagSessionDelta(tracker, "rag-s1", response);

    expect(result.response).toEqual(response);
    expect(result._session_savings).toBeDefined();
  });

  it("should report 0 savings on first call for a new sessionId", () => {
    const result = applyRagSessionDelta(tracker, "rag-fresh", {
      results: [{ docId: "d1" }],
    });

    expect(result._session_savings.skippedCount).toBe(0);
  });
});
