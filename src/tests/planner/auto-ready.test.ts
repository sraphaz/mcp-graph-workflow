import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { analyzeAutoReady } from "../../core/planner/auto-ready.js";
import { makeNode } from "../helpers/factories.js";

describe("analyzeAutoReady", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should identify backlog task with sprint + AC + no blockers as candidate", () => {
    store.insertNode(
      makeNode({
        type: "task",
        title: "Ready Task",
        status: "backlog",
        sprint: "s1",
        acceptanceCriteria: ["AC1"],
      }),
    );
    const doc = store.toGraphDocument();
    const report = analyzeAutoReady(doc);
    expect(report.totalCandidates).toBe(1);
    expect(report.candidates[0].title).toBe("Ready Task");
  });

  it("should exclude tasks without sprint", () => {
    store.insertNode(
      makeNode({
        type: "task",
        title: "No Sprint",
        status: "backlog",
        acceptanceCriteria: ["AC1"],
      }),
    );
    const doc = store.toGraphDocument();
    const report = analyzeAutoReady(doc);
    expect(report.totalCandidates).toBe(0);
  });

  it("should exclude tasks without AC", () => {
    store.insertNode(
      makeNode({
        type: "task",
        title: "No AC",
        status: "backlog",
        sprint: "s1",
      }),
    );
    const doc = store.toGraphDocument();
    const report = analyzeAutoReady(doc);
    expect(report.totalCandidates).toBe(0);
  });

  it("should exclude tasks with unresolved dependencies", () => {
    const dep = makeNode({
      id: "dep1",
      type: "task",
      title: "Dep",
      status: "backlog",
    });
    const task = makeNode({
      id: "t1",
      type: "task",
      title: "Blocked",
      status: "backlog",
      sprint: "s1",
      acceptanceCriteria: ["AC1"],
    });
    store.insertNode(dep);
    store.insertNode(task);
    store.insertEdge({
      id: "e1",
      from: "t1",
      to: "dep1",
      relationType: "depends_on",
      createdAt: "2025-01-01T00:00:00Z",
    });
    const doc = store.toGraphDocument();
    const report = analyzeAutoReady(doc);
    expect(report.totalCandidates).toBe(0);
  });

  it("should include task when all dependencies are done", () => {
    const dep = makeNode({
      id: "dep1",
      type: "task",
      title: "Dep",
      status: "done",
    });
    const task = makeNode({
      id: "t1",
      type: "task",
      title: "Unblocked",
      status: "backlog",
      sprint: "s1",
      acceptanceCriteria: ["AC1"],
    });
    store.insertNode(dep);
    store.insertNode(task);
    store.insertEdge({
      id: "e1",
      from: "t1",
      to: "dep1",
      relationType: "depends_on",
      createdAt: "2025-01-01T00:00:00Z",
    });
    const doc = store.toGraphDocument();
    const report = analyzeAutoReady(doc);
    expect(report.totalCandidates).toBe(1);
  });
});
