/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { getTouchedFiles, haveFileOverlap, getInFlightFileMap } from "../core/planner/touched-files.js";
import type { GraphNode } from "../core/graph/graph-types.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { LockManager } from "../core/store/lock-manager.js";

function node(id: string, touchedFiles?: unknown): GraphNode {
  return {
    id,
    type: "task",
    title: id,
    status: "backlog",
    priority: 3,
    blocked: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    metadata: touchedFiles !== undefined ? { touchedFiles } : undefined,
  } as GraphNode;
}

describe("getTouchedFiles", () => {
  it("returns empty when metadata is absent", () => {
    expect(getTouchedFiles(node("n1"))).toEqual([]);
  });

  it("returns empty when touchedFiles is not an array", () => {
    expect(getTouchedFiles(node("n1", "not-an-array"))).toEqual([]);
    expect(getTouchedFiles(node("n2", { foo: 1 }))).toEqual([]);
    expect(getTouchedFiles(node("n3", null))).toEqual([]);
  });

  it("filters out non-string entries", () => {
    const result = getTouchedFiles(node("n1", ["a.ts", 42, "b.ts", null, "c.ts"]));
    expect(result).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("returns the array as-is when under cap", () => {
    const files = ["x.ts", "y.ts", "z.ts"];
    expect(getTouchedFiles(node("n1", files))).toEqual(files);
  });

  it("caps at 20 entries when array is larger", () => {
    const files = Array.from({ length: 25 }, (_, i) => `f${i}.ts`);
    const result = getTouchedFiles(node("n1", files));
    expect(result).toHaveLength(20);
    expect(result[0]).toBe("f0.ts");
    expect(result[19]).toBe("f19.ts");
  });
});

describe("haveFileOverlap", () => {
  it("returns intersection of two file arrays", () => {
    expect(haveFileOverlap(["a.ts", "b.ts", "c.ts"], ["b.ts", "c.ts", "d.ts"])).toEqual([
      "b.ts",
      "c.ts",
    ]);
  });

  it("returns empty when there is no overlap", () => {
    expect(haveFileOverlap(["a.ts"], ["b.ts"])).toEqual([]);
  });

  it("returns empty when either side is empty", () => {
    expect(haveFileOverlap([], ["a.ts"])).toEqual([]);
    expect(haveFileOverlap(["a.ts"], [])).toEqual([]);
  });

  it("preserves order from the first argument", () => {
    expect(haveFileOverlap(["c.ts", "a.ts", "b.ts"], ["a.ts", "b.ts", "c.ts"])).toEqual([
      "c.ts",
      "a.ts",
      "b.ts",
    ]);
  });
});

describe("getInFlightFileMap", () => {
  it("returns empty map when there are no active locks", () => {
    const fakeStore = { getNodeById: () => null } as unknown as SqliteStore;
    const fakeLock = { listActive: () => [] } as unknown as LockManager;
    expect(getInFlightFileMap(fakeStore, fakeLock).size).toBe(0);
  });

  it("ignores locks not starting with 'task:'", () => {
    const fakeStore = { getNodeById: () => null } as unknown as SqliteStore;
    const fakeLock = {
      listActive: () => [{ resourceId: "session:abc", agentId: "a1" }],
    } as unknown as LockManager;
    expect(getInFlightFileMap(fakeStore, fakeLock).size).toBe(0);
  });

  it("builds nodeId → Set<file> map for active task locks", () => {
    const n = node("n1", ["a.ts", "b.ts"]);
    const fakeStore = {
      getNodeById: (id: string) => (id === "n1" ? n : null),
    } as unknown as SqliteStore;
    const fakeLock = {
      listActive: () => [{ resourceId: "task:n1", agentId: "a1" }],
    } as unknown as LockManager;
    const result = getInFlightFileMap(fakeStore, fakeLock);
    expect(result.size).toBe(1);
    expect(result.get("n1")).toEqual(new Set(["a.ts", "b.ts"]));
  });

  it("skips lock when node is not found", () => {
    const fakeStore = { getNodeById: () => null } as unknown as SqliteStore;
    const fakeLock = {
      listActive: () => [{ resourceId: "task:ghost", agentId: "a1" }],
    } as unknown as LockManager;
    expect(getInFlightFileMap(fakeStore, fakeLock).size).toBe(0);
  });
});
