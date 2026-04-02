import { describe, it, expect } from "vitest";
import { analyzeAssetBlockers } from "../../core/analyzer/asset-blockers.js";
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

describe("analyzeAssetBlockers", () => {
  it("should report no blockers when no assets exist", () => {
    const task = makeNode({ type: "task" });
    const doc = makeDoc([task]);
    const report = analyzeAssetBlockers(doc);

    expect(report.totalAssets).toBe(0);
    expect(report.blockedTaskCount).toBe(0);
    expect(report.blockingAssets).toHaveLength(0);
  });

  it("should report blocking asset with pending status", () => {
    const asset = makeNode({ type: "asset", title: "Hero Sprite", status: "in_progress" });
    const task = makeNode({ type: "task", title: "Implement hero animation" });
    const edge = makeEdge(task.id, asset.id, { relationType: "requires_asset" });

    const doc = makeDoc([asset, task], [edge]);
    const report = analyzeAssetBlockers(doc);

    expect(report.totalAssets).toBe(1);
    expect(report.pendingAssets).toBe(1);
    expect(report.blockedTaskCount).toBe(1);
    expect(report.blockingAssets[0].assetId).toBe(asset.id);
    expect(report.blockingAssets[0].blockedTaskIds).toContain(task.id);
  });

  it("should not report done assets as blockers", () => {
    const asset = makeNode({ type: "asset", title: "Done Sprite", status: "done" });
    const task = makeNode({ type: "task", title: "Use sprite" });
    const edge = makeEdge(task.id, asset.id, { relationType: "requires_asset" });

    const doc = makeDoc([asset, task], [edge]);
    const report = analyzeAssetBlockers(doc);

    expect(report.pendingAssets).toBe(0);
    expect(report.blockedTaskCount).toBe(0);
  });

  it("should count multiple tasks blocked by same asset", () => {
    const asset = makeNode({ type: "asset", title: "Tilemap", status: "backlog" });
    const t1 = makeNode({ type: "task", title: "Render map" });
    const t2 = makeNode({ type: "task", title: "Collision detection" });

    const edges = [
      makeEdge(t1.id, asset.id, { relationType: "requires_asset" }),
      makeEdge(t2.id, asset.id, { relationType: "requires_asset" }),
    ];

    const doc = makeDoc([asset, t1, t2], edges);
    const report = analyzeAssetBlockers(doc);

    expect(report.blockedTaskCount).toBe(2);
    expect(report.blockingAssets[0].blockedTaskIds).toHaveLength(2);
  });
});
