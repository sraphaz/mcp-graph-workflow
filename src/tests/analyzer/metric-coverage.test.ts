import { describe, it, expect } from "vitest";
import { analyzeMetricCoverage } from "../../core/analyzer/metric-coverage.js";
import { makeNode, makeEdge } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: ReturnType<typeof makeNode>[],
  edges: ReturnType<typeof makeEdge>[] = [],
): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "", updatedAt: "" },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyzeMetricCoverage", () => {
  it("should return 100% when no high risks exist", () => {
    const metric = makeNode({ type: "metric", title: "FPS Counter" });
    const doc = makeDoc([metric]);
    const report = analyzeMetricCoverage(doc);

    expect(report.totalMetrics).toBe(1);
    expect(report.totalHighRisks).toBe(0);
    expect(report.coveragePercent).toBe(100);
  });

  it("should report uncovered high risk without linked metric", () => {
    const risk = makeNode({ type: "risk", title: "Data loss", priority: 1 });
    const doc = makeDoc([risk]);
    const report = analyzeMetricCoverage(doc);

    expect(report.totalHighRisks).toBe(1);
    expect(report.uncoveredRisks).toHaveLength(1);
    expect(report.uncoveredRisks[0].nodeId).toBe(risk.id);
    expect(report.coveragePercent).toBe(0);
  });

  it("should report covered risk when linked to metric via edge", () => {
    const risk = makeNode({ type: "risk", title: "Performance degradation", priority: 2 });
    const metric = makeNode({ type: "metric", title: "Response time" });
    const edge = makeEdge(risk.id, metric.id, { relationType: "related_to" });

    const doc = makeDoc([risk, metric], [edge]);
    const report = analyzeMetricCoverage(doc);

    expect(report.coveredRisks).toContain(risk.id);
    expect(report.uncoveredRisks).toHaveLength(0);
    expect(report.coveragePercent).toBe(100);
  });

  it("should ignore low priority risks (3-5)", () => {
    const lowRisk = makeNode({ type: "risk", title: "Minor issue", priority: 3 });
    const doc = makeDoc([lowRisk]);
    const report = analyzeMetricCoverage(doc);

    expect(report.totalHighRisks).toBe(0);
    expect(report.coveragePercent).toBe(100);
  });
});
