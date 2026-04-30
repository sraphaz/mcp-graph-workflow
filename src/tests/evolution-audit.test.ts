/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-sweep-1 — Evolution audit (analyzer + store + MCP) integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { analyzeEvolutionAudit } from "../core/analyzer/evolution-audit.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";

function nodeFixture(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: overrides.id ?? "node-1",
    type: overrides.type ?? "task",
    title: overrides.title ?? "fixture",
    status: overrides.status ?? "backlog",
    priority: overrides.priority ?? 3,
    createdAt: overrides.createdAt ?? "2026-04-30T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-30T00:00:00.000Z",
    ...overrides,
  } as GraphNode;
}

describe("migration v85 — nodes.evolution_reason + evolution_count", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("evolution-audit-test");
  });

  afterEach(() => {
    store.close();
  });

  it("creates the evolution_reason and evolution_count columns", () => {
    const cols = store
      .getDb()
      .prepare("PRAGMA table_info(nodes)")
      .all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain("evolution_reason");
    expect(names).toContain("evolution_count");
  });

  it("inserts nodes with default evolution_count = 0", () => {
    store.insertNode(nodeFixture({ id: "n1", title: "task 1" }));
    const stored = store.getNodeById("n1");
    expect(stored).toBeTruthy();
    // count=0 → not surfaced on the typed object (kept slim)
    expect(stored?.evolutionCount).toBeUndefined();
    expect(stored?.evolutionReason).toBeUndefined();
  });

  it("updateNode with evolutionReason increments evolution_count", () => {
    store.insertNode(nodeFixture({ id: "n2", title: "task 2" }));
    store.updateNode("n2", { evolutionReason: "harness regression" });
    const after = store.getNodeById("n2");
    expect(after?.evolutionReason).toBe("harness regression");
    expect(after?.evolutionCount).toBe(1);

    store.updateNode("n2", { evolutionReason: "harness regression — second pass" });
    const after2 = store.getNodeById("n2");
    expect(after2?.evolutionCount).toBe(2);
  });

  it("updateNode with evolutionReason=null clears the reason and resets count", () => {
    store.insertNode(nodeFixture({ id: "n3", title: "task 3" }));
    store.updateNode("n3", { evolutionReason: "first reason" });
    expect(store.getNodeById("n3")?.evolutionCount).toBe(1);
    store.updateNode("n3", { evolutionReason: null });
    const after = store.getNodeById("n3");
    expect(after?.evolutionReason).toBeUndefined();
    expect(after?.evolutionCount).toBeUndefined();
  });
});

describe("analyzeEvolutionAudit", () => {
  function makeDoc(nodes: GraphNode[]): GraphDocument {
    return {
      version: "1.0",
      project: { id: "p", name: "test", createdAt: "x", updatedAt: "x" },
      nodes,
      edges: [],
      indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
      meta: { sourceFiles: [], lastImport: null },
    };
  }

  it("returns zeroed report when no nodes have been regenerated", () => {
    const r = analyzeEvolutionAudit(makeDoc([nodeFixture({ id: "n1" })]));
    expect(r.totalRegenerated).toBe(0);
    expect(r.totalRegenerations).toBe(0);
    expect(r.top).toEqual([]);
    expect(r.summary).toMatch(/no nodes regenerated/i);
  });

  it("counts regenerated nodes and aggregates reasons", () => {
    const r = analyzeEvolutionAudit(
      makeDoc([
        nodeFixture({ id: "a", evolutionReason: "harness regression", evolutionCount: 3 }),
        nodeFixture({ id: "b", evolutionReason: "harness regression", evolutionCount: 1 }),
        nodeFixture({ id: "c", evolutionReason: "cost runaway", evolutionCount: 2 }),
        nodeFixture({ id: "d" }),
      ]),
    );
    expect(r.totalRegenerated).toBe(3);
    expect(r.totalRegenerations).toBe(6);
    expect(r.byReason).toEqual([
      { reason: "harness regression", count: 2 },
      { reason: "cost runaway", count: 1 },
    ]);
    expect(r.top.map((e) => e.nodeId)).toEqual(["a", "c", "b"]);
  });

  it("respects topLimit option", () => {
    const fixtures: GraphNode[] = Array.from({ length: 15 }, (_, i) =>
      nodeFixture({ id: `n${i}`, evolutionReason: "x", evolutionCount: 15 - i }),
    );
    const r = analyzeEvolutionAudit(makeDoc(fixtures), { topLimit: 5 });
    expect(r.top).toHaveLength(5);
    expect(r.top[0]?.nodeId).toBe("n0");
  });
});
