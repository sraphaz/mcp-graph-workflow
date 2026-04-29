/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { finishTask } from "../core/pipeline/finish-task.js";
import { makeNode } from "./helpers/factories.js";

describe("finish_task skill proposal hook", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Skill Proposal Test");
    store.setProjectSetting("test_gate_mode", "off");

    store.insertNode(
      makeNode({
        id: "task-skill",
        type: "task",
        title: "Optimize sqlite query plan",
        status: "in_progress",
        description: "Tune index usage on graph store hot path",
        acceptanceCriteria: ["GIVEN slow query WHEN index added THEN p95 latency < 50ms"],
        estimateMinutes: 30,
      }),
    );
  });

  afterEach(() => {
    store.close();
  });

  it("emits skillProposal when rationale carries the 'discovered' heuristic", async () => {
    const result = await finishTask(store, "task-skill", {
      rationale: "discovered N+1 pattern; added covering index",
    });

    expect(result.status).toBe("done");
    expect(result.skillProposal).toBeTruthy();
    expect(result.skillProposal?.draft).toContain("---");
    expect(result.skillProposal?.draft).toContain("source_task: task-skill");
    expect(result.skillProposal?.domain).toBe("sqlite-perf");
  });

  it("emits skillProposal when rationale references an ADR", async () => {
    const result = await finishTask(store, "task-skill", {
      rationale: "Decision recorded as ADR-0099 — chose covering index over query rewrite",
    });

    expect(result.skillProposal).toBeTruthy();
    expect(result.skillProposal?.draft).toContain("source_task: task-skill");
  });

  it("does NOT emit skillProposal when no heuristic triggers", async () => {
    const result = await finishTask(store, "task-skill", {
      rationale: "Routine update; nothing notable",
    });

    expect(result.status).toBe("done");
    expect(result.skillProposal ?? null).toBeNull();
  });

  it("never writes the proposed skill to disk — caller decides", async () => {
    const result = await finishTask(store, "task-skill", {
      rationale: "discovered race condition in lock manager",
    });

    expect(result.skillProposal).toBeTruthy();
    // No file path should be returned — proposal is in-memory only
    expect((result.skillProposal as unknown as { filePath?: string })?.filePath).toBeUndefined();
  });
});
