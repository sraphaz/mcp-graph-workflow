/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  findStructuralCandidates,
  reclassifyStructural,
} from "../core/planner/reclassify-structural.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

function node(
  id: string,
  type: GraphNode["type"],
  title: string,
  metadata: Record<string, unknown> = {},
): GraphNode {
  return {
    id,
    type,
    title,
    status: "backlog",
    priority: 3,
    blocked: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    metadata,
  } as GraphNode;
}

function doc(nodes: GraphNode[]): GraphDocument {
  return { version: 1, project: { id: "p", name: "test" }, nodes, edges: [] } as unknown as GraphDocument;
}

describe("findStructuralCandidates", () => {
  it("returns empty when no node matches a pattern", () => {
    const d = doc([node("n1", "task", "Add user auth"), node("n2", "task", "Implement OAuth")]);
    expect(findStructuralCandidates(d)).toEqual([]);
  });

  it.each([
    ["TIER A — Foundation", "TIER X — heading"],
    ["Roadmap 2026", "Roadmap section"],
    ["Princípios de design", "Princípio section"],
    ["Sequenciamento de tarefas", "Sequenciamento section"],
    ["Arquivos críticos do projeto", "Arquivos críticos section"],
  ])("flags '%s' as structural with reason '%s'", (title, expectedReason) => {
    const d = doc([node("n1", "task", title)]);
    const found = findStructuralCandidates(d);
    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe(expectedReason);
  });

  it("flags titles with parenthetical count suffix", () => {
    const d = doc([node("n1", "task", "Onboarding (12 itens)")]);
    const found = findStructuralCandidates(d);
    expect(found[0].reason).toBe("parenthetical count suffix");
  });

  it("ignores non-eligible types (requirement, decision, etc.)", () => {
    const d = doc([
      node("r1", "requirement", "TIER A — should ignore"),
      node("d1", "decision", "Roadmap 2026"),
    ]);
    expect(findStructuralCandidates(d)).toEqual([]);
  });

  it("includes epic, task, and subtask types", () => {
    const d = doc([
      node("e1", "epic", "TIER A — auth"),
      node("t1", "task", "TIER B — ui"),
      node("s1", "subtask", "TIER C — api"),
    ]);
    expect(findStructuralCandidates(d)).toHaveLength(3);
  });

  it("alreadyMarked=true when metadata.implementable === false", () => {
    const d = doc([node("n1", "task", "TIER A — already marked", { implementable: false })]);
    const found = findStructuralCandidates(d);
    expect(found[0].alreadyMarked).toBe(true);
  });
});

describe("reclassifyStructural", () => {
  it("dry-run does not call store.updateNode", () => {
    let updateCalls = 0;
    const fakeStore = {
      updateNode: () => {
        updateCalls += 1;
        return null;
      },
    } as unknown as SqliteStore;
    const d = doc([node("n1", "task", "TIER A — heading")]);
    const report = reclassifyStructural(d, fakeStore, { apply: false });
    expect(updateCalls).toBe(0);
    expect(report.applied).toBe(0);
    expect(report.totalCandidates).toBe(1);
  });

  it("apply=true calls updateNode and counts applied", () => {
    let updateCalls = 0;
    const fakeStore = {
      updateNode: () => {
        updateCalls += 1;
        return { id: "n1" };
      },
    } as unknown as SqliteStore;
    const d = doc([node("n1", "task", "TIER A — heading")]);
    const report = reclassifyStructural(d, fakeStore, { apply: true });
    expect(updateCalls).toBe(1);
    expect(report.applied).toBe(1);
  });

  it("already-marked candidates count toward totalCandidates but not applied", () => {
    let updateCalls = 0;
    const fakeStore = {
      updateNode: () => {
        updateCalls += 1;
        return { id: "n1" };
      },
    } as unknown as SqliteStore;
    const d = doc([
      node("n1", "task", "TIER A — already", { implementable: false }),
      node("n2", "task", "Roadmap fresh"),
    ]);
    const report = reclassifyStructural(d, fakeStore, { apply: true });
    expect(report.totalCandidates).toBe(2);
    expect(report.applied).toBe(1);
    expect(updateCalls).toBe(1);
  });
});
