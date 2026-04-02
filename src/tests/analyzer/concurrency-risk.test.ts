import { describe, it, expect } from "vitest";
import { analyzeConcurrencyRisk } from "../../core/analyzer/concurrency-risk.js";
import { makeNode } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

function makeDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "", updatedAt: "" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyzeConcurrencyRisk", () => {
  it("should return no risks for tasks without concurrency keywords", () => {
    const task = makeNode({ type: "task", title: "Add login page" });
    const doc = makeDoc([task]);
    const report = analyzeConcurrencyRisk(doc);

    expect(report.totalRisks).toBe(0);
    expect(report.risks).toHaveLength(0);
  });

  it("should detect task with trade keyword", () => {
    const task = makeNode({ type: "task", title: "Implement trade system between players" });
    const doc = makeDoc([task]);
    const report = analyzeConcurrencyRisk(doc);

    expect(report.totalRisks).toBe(1);
    expect(report.risks[0].matchedKeywords).toContain("trade");
    expect(report.risks[0].suggestedTests.length).toBeGreaterThan(0);
  });

  it("should detect multiple keywords in description", () => {
    const task = makeNode({
      type: "task",
      title: "Handle concurrent inventory updates",
      description: "Must use atomic operations to prevent race conditions with gold transfers",
    });
    const doc = makeDoc([task]);
    const report = analyzeConcurrencyRisk(doc);

    expect(report.totalRisks).toBe(1);
    expect(report.risks[0].matchedKeywords).toContain("concurrent");
    expect(report.risks[0].matchedKeywords).toContain("atomic");
    expect(report.risks[0].matchedKeywords).toContain("gold");
  });

  it("should detect entity conflicts between flagged tasks", () => {
    const t1 = makeNode({ type: "task", title: "Concurrent inventory update for shop" });
    const t2 = makeNode({ type: "task", title: "Inventory display in shop panel" });
    const doc = makeDoc([t1, t2]);
    const report = analyzeConcurrencyRisk(doc);

    // t1 has "concurrent" keyword so it's flagged
    expect(report.totalRisks).toBeGreaterThanOrEqual(1);
    // entity conflicts should include shared keywords
    expect(report.entityConflicts.length).toBeGreaterThanOrEqual(1);
  });
});
