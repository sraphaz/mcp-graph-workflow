/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * provenance-backfill — pure cascade of source_file from ancestors.
 *
 * AC1 — child without source_file inherits from direct parent
 * AC2 — grand-child reaches ancestor through 2-hop parent_of chain
 * AC3 — node already with source_file is not overwritten
 * AC4 — orphan node (no parent_of edge) is not updated
 * AC5 — non-parent_of edges are ignored (depends_on, blocks, …)
 * AC6 — depth cap respected
 */

import { describe, it, expect } from "vitest";
import {
  computeProvenanceBackfill,
  type BackfillNode,
  type BackfillEdge,
} from "../../core/harness/provenance-backfill.js";

function n(id: string, sourceFile: string | null = null): BackfillNode {
  return { id, sourceFile };
}

function parentEdge(from: string, to: string): BackfillEdge {
  return { fromNode: from, toNode: to, relationType: "parent_of" };
}

describe("computeProvenanceBackfill", () => {
  it("AC1 — child inherits source_file from direct parent", () => {
    const updates = computeProvenanceBackfill({
      nodes: [n("epic", "docs/prd/foo.md"), n("task", null)],
      edges: [parentEdge("epic", "task")],
    });
    expect(updates).toEqual([
      { nodeId: "task", sourceFile: "docs/prd/foo.md", inheritedFrom: "epic" },
    ]);
  });

  it("AC2 — grand-child reaches ancestor through 2-hop chain", () => {
    const updates = computeProvenanceBackfill({
      nodes: [
        n("epic", "docs/prd/auth.md"),
        n("task", null),
        n("subtask", null),
      ],
      edges: [parentEdge("epic", "task"), parentEdge("task", "subtask")],
    });
    const subtask = updates.find((u) => u.nodeId === "subtask");
    expect(subtask).toEqual({
      nodeId: "subtask",
      sourceFile: "docs/prd/auth.md",
      inheritedFrom: "epic",
    });
  });

  it("AC3 — node with existing source_file is not overwritten", () => {
    const updates = computeProvenanceBackfill({
      nodes: [n("epic", "a.md"), n("task", "b.md")],
      edges: [parentEdge("epic", "task")],
    });
    expect(updates.find((u) => u.nodeId === "task")).toBeUndefined();
  });

  it("AC4 — orphan node receives no update", () => {
    const updates = computeProvenanceBackfill({
      nodes: [n("epic", "a.md"), n("orphan", null)],
      edges: [],
    });
    expect(updates).toEqual([]);
  });

  it("AC5 — non-parent_of edges are ignored", () => {
    const updates = computeProvenanceBackfill({
      nodes: [n("a", "a.md"), n("b", null)],
      edges: [{ fromNode: "a", toNode: "b", relationType: "depends_on" }],
    });
    expect(updates).toEqual([]);
  });

  it("AC6 — depth cap stops the cascade", () => {
    // Build a chain of 8 nodes; with default cap=6, the deepest 1 stays unset.
    const chain = Array.from({ length: 8 }, (_, i) => n(`n${i}`, i === 0 ? "root.md" : null));
    const edges = Array.from({ length: 7 }, (_, i) => parentEdge(`n${i}`, `n${i + 1}`));
    const updates = computeProvenanceBackfill({ nodes: chain, edges, maxDepth: 6 });
    const ids = updates.map((u) => u.nodeId).sort();
    // n1..n6 inherit; n7 is beyond cap.
    expect(ids).toEqual(["n1", "n2", "n3", "n4", "n5", "n6"]);
  });

  it("returns empty array for a graph that needs no work", () => {
    const updates = computeProvenanceBackfill({
      nodes: [n("a", "x.md"), n("b", "y.md")],
      edges: [parentEdge("a", "b")],
    });
    expect(updates).toEqual([]);
  });
});
