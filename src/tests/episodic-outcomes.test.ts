/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1: Tabela episodic_outcomes e indexacao ao finish_task
 * Tests for the episodic outcomes store — insert, query, and constraints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  insertEpisodicOutcome,
  queryEpisodicOutcomes,
  computeOutcome,
  buildTaskType,
  buildApproachSummary,
  type EpisodicOutcome,
} from "../core/store/episodic-outcomes-store.js";

describe("buildTaskType", () => {
  // AC2: GIVEN task with tags ["auth", "security"]
  //       WHEN episodic_outcomes inserted THEN task_type="auth,security" (sorted, normalized)
  it("sorts and normalizes tags", () => {
    expect(buildTaskType(["security", "auth"])).toBe("auth,security");
    expect(buildTaskType(["auth", "security"])).toBe("auth,security");
  });

  it("returns empty string for no tags", () => {
    expect(buildTaskType([])).toBe("");
    expect(buildTaskType(undefined)).toBe("");
  });

  it("deduplicates and lowercases", () => {
    expect(buildTaskType(["Auth", "AUTH", "auth"])).toBe("auth");
  });
});

describe("computeOutcome", () => {
  it("returns success for reopen_count = 0", () => {
    expect(computeOutcome(0)).toBe("success");
  });

  it("returns partial for reopen_count = 1", () => {
    expect(computeOutcome(1)).toBe("partial");
  });

  it("returns failure for reopen_count > 1", () => {
    expect(computeOutcome(2)).toBe("failure");
    expect(computeOutcome(5)).toBe("failure");
  });
});

describe("buildApproachSummary", () => {
  it("returns deterministic digest from touched files and AC ids", () => {
    const summary = buildApproachSummary(["src/b.ts", "src/a.ts"], ["ac-2", "ac-1"]);
    expect(summary).toBe("src/a.ts+src/b.ts:ac-1,ac-2");
  });

  it("returns empty digest when no files or ACs", () => {
    expect(buildApproachSummary([], [])).toBe(":");
  });
});

describe("insertEpisodicOutcome + queryEpisodicOutcomes", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Episodic Test");
  });

  afterEach(() => {
    store.close();
  });

  // AC1: GIVEN task done with finish_task WHEN episodic_outcomes consulted
  //       THEN record exists with task_type, cycle_time_delta, outcome
  it("inserts and retrieves an episodic outcome", () => {
    const node = makeNode({
      id: "task-auth-1",
      title: "Auth task",
      status: "done",
      tags: ["auth", "security"],
      estimateMinutes: 120,
    });
    store.insertNode(node);

    const outcome: EpisodicOutcome = {
      id: "ep-001",
      nodeId: "task-auth-1",
      taskType: buildTaskType(["auth", "security"]),
      tags: "auth,security",
      approachSummary: buildApproachSummary(["src/auth.ts"], ["ac-1"]),
      outcome: "success",
      cycleTimeDelta: 1.5,
      reopenCount: 0,
      createdAt: Date.now(),
    };

    insertEpisodicOutcome(store.getDb(), outcome);

    const results = queryEpisodicOutcomes(store.getDb(), { limit: 10 });
    expect(results).toHaveLength(1);
    expect(results[0].taskType).toBe("auth,security");
    expect(results[0].cycleTimeDelta).toBeCloseTo(1.5);
    expect(results[0].outcome).toBe("success");
  });

  // AC2: GIVEN task with tags ["auth", "security"] WHEN inserted THEN task_type="auth,security"
  it("stores sorted normalized task_type", () => {
    const episode: EpisodicOutcome = {
      id: "ep-002",
      nodeId: "task-2",
      taskType: buildTaskType(["security", "auth"]),
      tags: "auth,security",
      approachSummary: ":",
      outcome: "success",
      cycleTimeDelta: 0,
      reopenCount: 0,
      createdAt: Date.now(),
    };
    insertEpisodicOutcome(store.getDb(), episode);

    const results = queryEpisodicOutcomes(store.getDb(), { taskType: "auth,security" });
    expect(results).toHaveLength(1);
    expect(results[0].taskType).toBe("auth,security");
  });

  it("queries by taskType filter", () => {
    // Insert two episodes with different task types
    insertEpisodicOutcome(store.getDb(), {
      id: "ep-a", nodeId: "n1", taskType: "auth,security", tags: "auth,security",
      approachSummary: ":", outcome: "success", cycleTimeDelta: 0, reopenCount: 0, createdAt: 1000,
    });
    insertEpisodicOutcome(store.getDb(), {
      id: "ep-b", nodeId: "n2", taskType: "parser,transform", tags: "parser,transform",
      approachSummary: ":", outcome: "failure", cycleTimeDelta: 5.0, reopenCount: 2, createdAt: 2000,
    });

    const authResults = queryEpisodicOutcomes(store.getDb(), { taskType: "auth,security" });
    expect(authResults).toHaveLength(1);
    expect(authResults[0].id).toBe("ep-a");

    const allResults = queryEpisodicOutcomes(store.getDb(), { limit: 10 });
    expect(allResults).toHaveLength(2);
  });

  // AC4: GIVEN 100+ episodes accumulated WHEN queried THEN <10ms
  it("queries 100+ episodes in under 10ms", () => {
    const db = store.getDb();
    // Batch insert 120 episodes
    const insert = db.prepare(
      `INSERT INTO episodic_outcomes (id, node_id, task_type, tags, approach_summary, outcome, cycle_time_delta, reopen_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMany = db.transaction(() => {
      for (let i = 0; i < 120; i++) {
        insert.run(
          `ep-${i}`, `node-${i}`, `type-${i % 5}`, `tag${i % 5}`,
          ":", "success", 0.5, 0, Date.now() + i,
        );
      }
    });
    insertMany();

    const start = performance.now();
    const results = queryEpisodicOutcomes(db, { taskType: "type-0", limit: 50 });
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10); // P95 < 10ms AC
  });
});
