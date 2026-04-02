import { describe, it, expect } from "vitest";
import { analyzeContractCoverage } from "../../core/analyzer/contract-coverage.js";
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

describe("analyzeContractCoverage", () => {
  it("should return 100% coverage when no contracts exist", () => {
    const doc = makeDoc([makeNode({ type: "task" })]);
    const report = analyzeContractCoverage(doc);

    expect(report.totalContracts).toBe(0);
    expect(report.coveragePercent).toBe(100);
    expect(report.uncoveredContracts).toHaveLength(0);
  });

  it("should report full coverage when contract has both provider and consumer", () => {
    const contract = makeNode({ type: "contract", title: "Auth API" });
    const provider = makeNode({ type: "task", title: "Auth Service" });
    const consumer = makeNode({ type: "task", title: "Frontend" });

    const edges = [
      makeEdge(provider.id, contract.id, { relationType: "provides" }),
      makeEdge(consumer.id, contract.id, { relationType: "consumes" }),
    ];

    const doc = makeDoc([contract, provider, consumer], edges);
    const report = analyzeContractCoverage(doc);

    expect(report.totalContracts).toBe(1);
    expect(report.coveragePercent).toBe(100);
    expect(report.contracts[0].hasProvider).toBe(true);
    expect(report.contracts[0].hasConsumer).toBe(true);
    expect(report.uncoveredContracts).toHaveLength(0);
  });

  it("should report uncovered contract missing provider", () => {
    const contract = makeNode({ type: "contract", title: "Payment API" });
    const consumer = makeNode({ type: "task", title: "Checkout" });

    const edges = [
      makeEdge(consumer.id, contract.id, { relationType: "consumes" }),
    ];

    const doc = makeDoc([contract, consumer], edges);
    const report = analyzeContractCoverage(doc);

    expect(report.totalContracts).toBe(1);
    expect(report.coveragePercent).toBe(0);
    expect(report.contracts[0].hasProvider).toBe(false);
    expect(report.contracts[0].hasConsumer).toBe(true);
    expect(report.uncoveredContracts).toContain(contract.id);
  });

  it("should calculate correct coverage across multiple contracts", () => {
    const c1 = makeNode({ type: "contract", title: "API A" });
    const c2 = makeNode({ type: "contract", title: "API B" });
    const svc = makeNode({ type: "task", title: "Service" });

    const edges = [
      makeEdge(svc.id, c1.id, { relationType: "provides" }),
      makeEdge(svc.id, c1.id, { relationType: "consumes" }),
      // c2 has no edges — uncovered
    ];

    const doc = makeDoc([c1, c2, svc], edges);
    const report = analyzeContractCoverage(doc);

    expect(report.totalContracts).toBe(2);
    expect(report.coveragePercent).toBe(50);
    expect(report.uncoveredContracts).toContain(c2.id);
  });
});
