/**
 * Tests for unified Graph Health Scanner.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { scanGraphHealth } from "../core/graph/graph-health-scanner.js";
import { makeNode, makeEpic } from "./helpers/factories.js";

describe("Graph Health Scanner", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("health-test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return clean report for healthy graph", () => {
    const epic = makeEpic({ title: "Epic" });
    const task = makeNode({ title: "Task", parentId: epic.id, status: "done" });
    store.insertNode(epic);
    store.insertNode(task);
    store.insertEdge({ id: "e1", from: epic.id, to: task.id, relationType: "parent_of", createdAt: epic.createdAt });

    const doc = store.toGraphDocument();
    const report = scanGraphHealth(doc);

    expect(report.nodeCount).toBe(2);
    expect(report.edgeCount).toBe(1);
    expect(report.summary.critical).toBe(0);
    expect(report.scanDurationMs).toBeLessThan(100);
  });

  it("should detect dependency cycles", () => {
    const a = makeNode({ id: "a", title: "A" });
    const b = makeNode({ id: "b", title: "B" });
    store.insertNode(a);
    store.insertNode(b);
    store.insertEdge({ id: "e1", from: "a", to: "b", relationType: "depends_on", createdAt: a.createdAt });
    store.insertEdge({ id: "e2", from: "b", to: "a", relationType: "depends_on", createdAt: a.createdAt });

    const doc = store.toGraphDocument();
    const report = scanGraphHealth(doc);

    const cycleIssues = report.issues.filter(i => i.category === "cycle");
    expect(cycleIssues.length).toBeGreaterThan(0);
    expect(cycleIssues[0].severity).toBe("critical");
  });

  it("should complete scan in < 50ms for 100 nodes", () => {
    for (let i = 0; i < 100; i++) {
      store.insertNode(makeNode({ title: `Node ${i}` }));
    }

    const doc = store.toGraphDocument();
    const report = scanGraphHealth(doc);

    expect(report.scanDurationMs).toBeLessThan(50);
    expect(report.nodeCount).toBe(100);
  });

  it("should report issue counts in summary", () => {
    // Create nodes with various issues
    const task = makeNode({ title: "Done task", status: "done", blocked: true });
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const report = scanGraphHealth(doc);

    expect(report.summary.total).toBe(report.issues.length);
    expect(report.summary.critical + report.summary.warning + report.summary.info).toBe(report.summary.total);
  });
});
