/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { makeEpic, makeNode } from "../helpers/factories.js";
import {
  persistDecomposition,
  autoDecomposeLarge,
} from "../../core/planner/auto-decompose.js";
import { smartDecompose } from "../../core/planner/smart-decompose.js";

describe("persistDecomposition", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Auto-decompose Test");
  });

  afterEach(() => {
    store.close();
  });

  it("creates subtask nodes and edges for a decomposition result", () => {
    const epic = makeEpic({ title: "E" });
    store.insertNode(epic);
    const parent = makeNode({
      title: "Parent L",
      parentId: epic.id,
      xpSize: "L",
      acceptanceCriteria: [
        "POST /api/login returns JWT",
        "Invalid credentials return 401",
      ],
    });
    store.insertNode(parent);

    const result = smartDecompose(store, parent.id);
    expect(result).not.toBeNull();

    const persisted = persistDecomposition(store, result!);

    expect(persisted.createdNodeIds).toHaveLength(2);
    expect(persisted.createdEdgeCount).toBe(1);

    const doc = store.toGraphDocument();
    const children = doc.nodes.filter((n) => n.parentId === parent.id && n.type === "subtask");
    expect(children).toHaveLength(2);
    const depEdges = doc.edges.filter((e) => e.relationType === "depends_on");
    expect(depEdges).toHaveLength(1);
  });
});

describe("autoDecomposeLarge", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Auto-decompose Test");
  });

  afterEach(() => {
    store.close();
  });

  function seedEpicAndTask(overrides: Parameters<typeof makeNode>[0] = {}): string {
    const epic = makeEpic({ title: "E" });
    store.insertNode(epic);
    const task = makeNode({ parentId: epic.id, ...overrides });
    store.insertNode(task);
    return task.id;
  }

  it("decomposes L/XL tasks that have no children and ≥2 ACs", () => {
    const id = seedEpicAndTask({
      title: "Large task",
      xpSize: "L",
      acceptanceCriteria: ["AC one should pass", "AC two should pass"],
    });

    const report = autoDecomposeLarge(store);

    expect(report.decomposed.map((d) => d.parentId)).toContain(id);
    const children = store.toGraphDocument().nodes.filter((n) => n.parentId === id && n.type === "subtask");
    expect(children.length).toBe(2);
  });

  it("skips small/medium tasks", () => {
    seedEpicAndTask({ title: "Small", xpSize: "S", acceptanceCriteria: ["a", "b"] });
    seedEpicAndTask({ title: "Medium", xpSize: "M", acceptanceCriteria: ["a", "b", "c"] });
    const report = autoDecomposeLarge(store);
    expect(report.decomposed).toHaveLength(0);
  });

  it("skips tasks that already have children", () => {
    const id = seedEpicAndTask({
      title: "Already split",
      xpSize: "L",
      acceptanceCriteria: ["a", "b"],
    });
    store.insertNode(makeNode({ parentId: id, type: "subtask", title: "existing child" }));
    const report = autoDecomposeLarge(store);
    expect(report.decomposed).toHaveLength(0);
    expect(report.skipped.some((s) => s.parentId === id && s.reason === "has_children")).toBe(true);
  });

  it("skips tasks with fewer than 2 ACs (nothing to split)", () => {
    const id = seedEpicAndTask({
      title: "Single AC",
      xpSize: "L",
      acceptanceCriteria: ["only one AC"],
    });
    const report = autoDecomposeLarge(store);
    expect(report.decomposed).toHaveLength(0);
    expect(report.skipped.some((s) => s.parentId === id && s.reason === "insufficient_acs")).toBe(true);
  });

  it("refuses to create more than maxSubtasks subtasks per parent", () => {
    const id = seedEpicAndTask({
      title: "Very wide",
      xpSize: "XL",
      acceptanceCriteria: new Array(20).fill(0).map((_, i) => `AC ${i + 1} should pass`),
    });
    const report = autoDecomposeLarge(store, { maxSubtasks: 8 });
    expect(report.decomposed).toHaveLength(0);
    expect(report.skipped.some((s) => s.parentId === id && s.reason === "too_many_acs")).toBe(true);
  });
});
