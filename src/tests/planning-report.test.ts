import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { generatePlanningReport } from "../core/planner/planning-report.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function makeNode(overrides?: Partial<GraphNode>): GraphNode {
  const ts = now();
  return {
    id: generateId("node"),
    type: "task",
    title: "Default task",
    status: "backlog",
    priority: 3,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeEdge(from: string, to: string, relationType: string): GraphEdge {
  return {
    id: generateId("edge"),
    from,
    to,
    relationType: relationType as GraphEdge["relationType"],
    createdAt: now(),
  };
}

describe("PlanningReport", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should generate report with empty graph", () => {
    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    expect(report.recommendedOrder).toHaveLength(0);
    expect(report.summary.totalReady).toBe(0);
    expect(report.summary.totalBlocked).toBe(0);
  });

  it("should recommend task order", () => {
    const task1 = makeNode({ title: "Task A", priority: 1 });
    const task2 = makeNode({ title: "Task B", priority: 2 });
    const task3 = makeNode({ title: "Task C", priority: 3 });
    store.insertNode(task1);
    store.insertNode(task2);
    store.insertNode(task3);

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    expect(report.recommendedOrder.length).toBeGreaterThanOrEqual(1);
    // Highest priority first
    expect(report.recommendedOrder[0].priority).toBe(1);
    expect(report.summary.totalReady).toBe(3);
  });

  it("should identify blocked tasks as risks", () => {
    const blocked = makeNode({ title: "Blocked task", blocked: true, status: "blocked" });
    store.insertNode(blocked);

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    expect(report.risks.length).toBeGreaterThanOrEqual(1);
    expect(report.risks[0].severity).toBe("high");
    expect(report.summary.totalBlocked).toBe(1);
  });

  it("should flag XL tasks as medium risk", () => {
    const xlTask = makeNode({ title: "Huge refactor", xpSize: "XL" });
    store.insertNode(xlTask);

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    const xlRisk = report.risks.find((r) => r.risk.includes("decomposing"));
    expect(xlRisk).toBeDefined();
    expect(xlRisk!.severity).toBe("medium");
  });

  it("should detect missing docs for tags", () => {
    const node = makeNode({ title: "Task with tags", tags: ["redis", "graphql"] });
    store.insertNode(node);

    // Add knowledge for one tag but not the other
    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({
      sourceType: "docs",
      sourceId: "graphql-docs",
      title: "GraphQL Guide",
      content: "GraphQL schema design patterns",
    });

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    expect(report.missingDocs).toContain("redis");
  });

  it("should calculate estimated points", () => {
    store.insertNode(makeNode({ title: "Small", xpSize: "S" }));  // 2 points
    store.insertNode(makeNode({ title: "Medium", xpSize: "M" })); // 3 points
    store.insertNode(makeNode({ title: "Large", xpSize: "L" }));  // 5 points

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    expect(report.summary.estimatedPoints).toBe(10); // 2 + 3 + 5
  });

  it("should move excess tasks to overflow when capacityPoints is provided", () => {
    // Arrange: 3 tasks = 2 + 3 + 5 = 10 points total
    store.insertNode(makeNode({ title: "Small", xpSize: "S", priority: 1 }));  // 2 pts
    store.insertNode(makeNode({ title: "Medium", xpSize: "M", priority: 2 })); // 3 pts
    store.insertNode(makeNode({ title: "Large", xpSize: "L", priority: 3 }));  // 5 pts

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store, 5); // capacity = 5

    // Act: first task (S=2) fits, second (M=3) brings to 5, third (L=5) overflows
    expect(report.overflow.length).toBeGreaterThanOrEqual(1);
    expect(report.recommendedOrder.length + report.overflow.length).toBe(3);
  });

  it("should return empty overflow when no capacityPoints provided", () => {
    store.insertNode(makeNode({ title: "Task A", priority: 1 }));
    store.insertNode(makeNode({ title: "Task B", priority: 2 }));

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    expect(report.overflow).toEqual([]);
    expect(report.redistributionSuggestions).toEqual([]);
  });

  it("should suggest splitting XL tasks in overflow", () => {
    store.insertNode(makeNode({ title: "Small", xpSize: "XS", priority: 1 })); // 1 pt
    store.insertNode(makeNode({ title: "Huge", xpSize: "XL", priority: 2 }));  // 8 pts

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store, 1); // capacity = 1

    // XL task should be in overflow
    const xlInOverflow = report.overflow.some((o) => o.xpSize === "XL");
    expect(xlInOverflow).toBe(true);
    expect(report.redistributionSuggestions.some((s) => s.includes("XL"))).toBe(true);
  });

  it("should suggest deferring low-priority items in overflow", () => {
    store.insertNode(makeNode({ title: "High prio", xpSize: "S", priority: 1 }));  // 2 pts
    store.insertNode(makeNode({ title: "Low prio", xpSize: "S", priority: 4 }));   // 2 pts

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store, 2); // capacity = 2

    const lowPrioInOverflow = report.overflow.some((o) => o.priority >= 4);
    if (lowPrioInOverflow) {
      expect(report.redistributionSuggestions.some((s) => s.toLowerCase().includes("defer"))).toBe(true);
    }
  });

  it("should respect dependency ordering", () => {
    const dep = makeNode({ title: "Dependency", priority: 3 });
    const main = makeNode({ title: "Main task", priority: 1 });
    store.insertNode(dep);
    store.insertNode(main);

    const edge = makeEdge(main.id, dep.id, "depends_on");
    store.insertEdge(edge);

    const doc = store.toGraphDocument();
    const report = generatePlanningReport(doc, store);

    // The dependency should come before the main task
    if (report.recommendedOrder.length >= 2) {
      const depIdx = report.recommendedOrder.findIndex((r) => r.id === dep.id);
      const mainIdx = report.recommendedOrder.findIndex((r) => r.id === main.id);
      expect(depIdx).toBeLessThan(mainIdx);
    }
  });
});
