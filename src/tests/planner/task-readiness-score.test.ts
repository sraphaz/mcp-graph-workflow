import { describe, it, expect } from "vitest";
import {
  computeTaskReadinessScore,
  type TaskReadinessScore,
} from "../../core/planner/task-readiness-score.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function task(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: overrides.id ?? "t1",
    type: "task",
    title: "Minimal task",
    description: "",
    status: "ready",
    priority: 3,
    ...overrides,
  } as GraphNode;
}

function doc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "p1", name: "p", createdAt: "2026-01-01T00:00:00Z" },
    nodes,
    edges,
    indexes: {
      byId: Object.fromEntries(nodes.map((n) => [n.id, n])),
      byType: {},
      byStatus: {},
      outEdges: {},
      inEdges: {},
    },
    meta: { lastUpdated: "2026-01-01T00:00:00Z" },
  } as unknown as GraphDocument;
}

function withTestableAc(node: GraphNode): GraphNode {
  // ACs phrased to satisfy ac-validator: testable verbs ("returns"), measurable values (200, 400).
  return {
    ...node,
    acceptanceCriteria: [
      "Given a valid request, when POST /api/x is called, then the endpoint returns status 200",
      "Given an invalid body, when POST /api/x is called, then the endpoint returns status 400",
    ],
  } as GraphNode;
}

describe("computeTaskReadinessScore", () => {
  it("recommends haiku for a small task with testable AC and healthy harness", () => {
    const node = withTestableAc(task({ xpSize: "S" }));
    const result: TaskReadinessScore = computeTaskReadinessScore(node, doc([node]), {
      harnessScore: 85,
    });
    expect(result.recommendation).toBe("haiku");
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.signals.acQuality.hasTestableAc).toBe(true);
  });

  it("recommends sonnet for a medium task with testable AC", () => {
    const node = withTestableAc(task({ xpSize: "M" }));
    const result = computeTaskReadinessScore(node, doc([node]), { harnessScore: 70 });
    expect(result.recommendation).toBe("sonnet");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(85);
  });

  it("escalates to opus for an XL task with no testable AC", () => {
    const node = task({ xpSize: "XL" }); // no AC
    const result = computeTaskReadinessScore(node, doc([node]), { harnessScore: 40 });
    expect(result.recommendation).toBe("opus");
    expect(result.overridden).toBe("no_testable_ac");
  });

  it("always returns opus for high-stake node types regardless of score", () => {
    const node = withTestableAc(task({ xpSize: "S", type: "decision" }));
    const result = computeTaskReadinessScore(node, doc([node]), { harnessScore: 95 });
    expect(result.recommendation).toBe("opus");
    expect(result.overridden).toBe("high_stake_type");
  });

  it("considers dependency depth — deeper chains lower the score", () => {
    // Build a chain: t3 depends_on t2, t2 depends_on t1
    const t1 = withTestableAc(task({ id: "t1", xpSize: "S" }));
    const t2 = withTestableAc(task({ id: "t2", xpSize: "S" }));
    const t3 = withTestableAc(task({ id: "t3", xpSize: "S" }));
    const edges: GraphEdge[] = [
      { from: "t3", to: "t2", relationType: "depends_on" } as GraphEdge,
      { from: "t2", to: "t1", relationType: "depends_on" } as GraphEdge,
    ];
    const scoreIsolated = computeTaskReadinessScore(t1, doc([t1, t2, t3], edges), { harnessScore: 85 });
    const scoreChain = computeTaskReadinessScore(t3, doc([t1, t2, t3], edges), { harnessScore: 85 });
    expect(scoreChain.signals.depDepth.depth).toBeGreaterThan(scoreIsolated.signals.depDepth.depth);
    expect(scoreChain.score).toBeLessThan(scoreIsolated.score);
  });

  it("is robust against dependency cycles", () => {
    const a = withTestableAc(task({ id: "a" }));
    const b = withTestableAc(task({ id: "b" }));
    const edges: GraphEdge[] = [
      { from: "a", to: "b", relationType: "depends_on" } as GraphEdge,
      { from: "b", to: "a", relationType: "depends_on" } as GraphEdge,
    ];
    expect(() =>
      computeTaskReadinessScore(a, doc([a, b], edges), { harnessScore: 75 }),
    ).not.toThrow();
  });

  it("applies an issue-pattern penalty when provided", () => {
    const node = withTestableAc(task({ xpSize: "S" }));
    const clean = computeTaskReadinessScore(node, doc([node]), { harnessScore: 85 });
    const stained = computeTaskReadinessScore(node, doc([node]), {
      harnessScore: 85,
      patternOccurrences: 3,
    });
    expect(stained.score).toBeLessThan(clean.score);
    expect(stained.signals.issuePatternPenalty).toBeGreaterThan(0);
  });

  it("produces at least one rationale entry explaining the decision", () => {
    const node = withTestableAc(task({ xpSize: "M" }));
    const result = computeTaskReadinessScore(node, doc([node]), { harnessScore: 70 });
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("defaults harness to a neutral value when not provided", () => {
    const node = withTestableAc(task({ xpSize: "S" }));
    const result = computeTaskReadinessScore(node, doc([node]));
    expect(result.signals.harnessLocal).toBeNull();
    expect(result.recommendation).toMatch(/haiku|sonnet/);
  });
});
