import { describe, it, expect } from "vitest";
import { analyzeConfigCoverage } from "../../core/analyzer/config-coverage.js";
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

describe("analyzeConfigCoverage", () => {
  it("should return 100% when no config_schema nodes exist", () => {
    const task = makeNode({ type: "task" });
    const doc = makeDoc([task]);
    const report = analyzeConfigCoverage(doc);

    expect(report.totalConfigs).toBe(0);
    expect(report.coveragePercent).toBe(100);
  });

  it("should report orphan config with no referencedBy", () => {
    const config = makeNode({
      type: "config_schema",
      title: "Game Settings",
      metadata: {},
    });
    const doc = makeDoc([config]);
    const report = analyzeConfigCoverage(doc);

    expect(report.totalConfigs).toBe(1);
    expect(report.orphanConfigs).toHaveLength(1);
    expect(report.orphanConfigs[0].nodeId).toBe(config.id);
    expect(report.coveragePercent).toBe(0);
  });

  it("should report full coverage when config has referencedBy", () => {
    const config = makeNode({
      type: "config_schema",
      id: "cfg1",
      title: "Difficulty Config",
      metadata: { referencedBy: ["task1", "task2"] },
    });
    const doc = makeDoc([config]);
    const report = analyzeConfigCoverage(doc);

    expect(report.totalConfigs).toBe(1);
    expect(report.orphanConfigs).toHaveLength(0);
    expect(report.coveragePercent).toBe(100);
  });

  it("should report referenced-but-undefined configs", () => {
    const config = makeNode({
      type: "config_schema",
      id: "cfg1",
      title: "Known Config",
      metadata: { referencedBy: ["unknown_cfg"] },
    });
    const doc = makeDoc([config]);
    const report = analyzeConfigCoverage(doc);

    expect(report.referencedButUndefined).toContain("unknown_cfg");
  });
});
