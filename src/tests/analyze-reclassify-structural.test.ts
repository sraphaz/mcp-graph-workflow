/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { reclassifyStructural, findStructuralCandidates } from "../core/planner/reclassify-structural.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function nodeFor(id: string, title: string, type: GraphNode["type"] = "task"): GraphNode {
  return {
    id,
    type,
    title,
    status: "backlog",
    priority: 3,
    blocked: false,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

describe("reclassify_structural", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.openDb(":memory:");
    store.initProject("test");
  });

  it("dry-run lists candidates without mutating", () => {
    store.insertNode(nodeFor("n1", "TIER A — Alto valor (7 itens)"));
    store.insertNode(nodeFor("n2", "Implementar autenticação"));
    store.insertNode(nodeFor("n3", "Sequenciamento (4 sprints, ordem por dependência)", "epic"));

    const doc = store.toGraphDocument();
    const report = reclassifyStructural(doc, store, { apply: false });

    expect(report.totalCandidates).toBe(2);
    expect(report.applied).toBe(0);
    expect(report.candidates.map((c) => c.nodeId).sort()).toEqual(["n1", "n3"]);

    const fresh = store.getNodeById("n1");
    expect(fresh?.metadata?.implementable).toBeUndefined();
  });

  it("apply=true persists metadata.implementable=false", () => {
    store.insertNode(nodeFor("n1", "TIER A — Alto valor (7 itens)"));
    store.insertNode(nodeFor("n2", "Implementar autenticação"));

    const doc = store.toGraphDocument();
    const report = reclassifyStructural(doc, store, { apply: true });

    expect(report.applied).toBe(1);
    expect(store.getNodeById("n1")?.metadata?.implementable).toBe(false);
    expect(store.getNodeById("n2")?.metadata?.implementable).toBeUndefined();
  });

  it("is idempotent on already-marked nodes", () => {
    const node = nodeFor("n1", "TIER A — Alto valor (7 itens)");
    node.metadata = { implementable: false, origin: "imported" };
    store.insertNode(node);

    const doc = store.toGraphDocument();
    const report = reclassifyStructural(doc, store, { apply: true });

    expect(report.totalCandidates).toBe(1);
    expect(report.applied).toBe(0);
    expect(report.candidates[0].alreadyMarked).toBe(true);
    expect(store.getNodeById("n1")?.metadata?.origin).toBe("imported");
  });

  it("findStructuralCandidates excludes non-eligible types", () => {
    store.insertNode(nodeFor("n1", "TIER A — fakery (1 itens)", "requirement"));
    store.insertNode(nodeFor("n2", "TIER A — real (1 itens)", "task"));

    const doc = store.toGraphDocument();
    const candidates = findStructuralCandidates(doc);
    expect(candidates.map((c) => c.nodeId)).toEqual(["n2"]);
  });
});
