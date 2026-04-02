import { describe, it, expect } from "vitest";
import { analyzeScenarioCoverage } from "../../core/analyzer/scenario-coverage.js";
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

describe("analyzeScenarioCoverage", () => {
  it("should return 100% when no epics/tasks exist", () => {
    const scenario = makeNode({
      type: "scenario",
      title: "Test scenario",
      metadata: { systemsInvolved: ["combat"] },
    });
    const doc = makeDoc([scenario]);
    const report = analyzeScenarioCoverage(doc);

    expect(report.totalScenarios).toBe(1);
    expect(report.coveragePercent).toBe(100);
  });

  it("should report covered systems matching epic/task titles", () => {
    const epic = makeNode({ type: "epic", title: "Combat System" });
    const scenario = makeNode({
      type: "scenario",
      title: "PvP battle",
      metadata: { systemsInvolved: ["combat system"] },
    });
    const doc = makeDoc([epic, scenario]);
    const report = analyzeScenarioCoverage(doc);

    expect(report.systemsCovered).toContain("combat system");
    expect(report.coveragePercent).toBe(100);
  });

  it("should report uncovered systems", () => {
    const epic1 = makeNode({ type: "epic", title: "Combat" });
    const epic2 = makeNode({ type: "epic", title: "Inventory" });
    const scenario = makeNode({
      type: "scenario",
      title: "Battle flow",
      metadata: { systemsInvolved: ["combat"] },
    });
    const doc = makeDoc([epic1, epic2, scenario]);
    const report = analyzeScenarioCoverage(doc);

    expect(report.systemsCovered).toContain("combat");
    expect(report.systemsUncovered).toContain("inventory");
    expect(report.coveragePercent).toBe(50);
  });

  it("should return 100% when no scenarios exist and no systems", () => {
    const doc = makeDoc([]);
    const report = analyzeScenarioCoverage(doc);
    expect(report.totalScenarios).toBe(0);
    expect(report.coveragePercent).toBe(100);
  });
});
