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

import { describe, it, expect, vi } from "vitest";
import {
  getTouchedFiles,
  haveFileOverlap,
  getInFlightFileMap,
} from "../../core/planner/touched-files.js";
import type { GraphNode } from "../../core/graph/graph-types.js";
import type { LockManager } from "../../core/store/lock-manager.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

function buildNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_test",
    type: "task",
    title: "Test task",
    status: "in_progress",
    priority: 2,
    blocked: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as GraphNode;
}

describe("getTouchedFiles", () => {
  it("should return empty array when metadata is absent", () => {
    const node = buildNode({ metadata: undefined });

    expect(getTouchedFiles(node)).toEqual([]);
  });

  it("should return empty array when touchedFiles is absent", () => {
    const node = buildNode({ metadata: { someOtherKey: "value" } });

    expect(getTouchedFiles(node)).toEqual([]);
  });

  it("should return touchedFiles when present and valid string array", () => {
    const files = ["src/foo.ts", "src/bar.ts"];
    const node = buildNode({ metadata: { touchedFiles: files } });

    expect(getTouchedFiles(node)).toEqual(files);
  });

  it("should return empty array when touchedFiles is not an array", () => {
    const node = buildNode({ metadata: { touchedFiles: "src/foo.ts" } });

    expect(getTouchedFiles(node)).toEqual([]);
  });

  it("should filter out non-string entries silently", () => {
    const node = buildNode({ metadata: { touchedFiles: ["src/foo.ts", 42, null, "src/bar.ts"] } });

    expect(getTouchedFiles(node)).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  it("should cap at 20 entries and warn", () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`);
    const node = buildNode({ metadata: { touchedFiles: files } });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = getTouchedFiles(node);

    expect(result).toHaveLength(20);
    warnSpy.mockRestore();
  });
});

describe("haveFileOverlap", () => {
  it("should return empty array when no overlap", () => {
    expect(haveFileOverlap(["src/a.ts"], ["src/b.ts"])).toEqual([]);
  });

  it("should return overlapping files", () => {
    const result = haveFileOverlap(
      ["src/a.ts", "src/shared.ts"],
      ["src/b.ts", "src/shared.ts"],
    );

    expect(result).toEqual(["src/shared.ts"]);
  });

  it("should return multiple overlapping files", () => {
    const a = ["src/x.ts", "src/y.ts", "src/z.ts"];
    const b = ["src/y.ts", "src/z.ts", "src/w.ts"];

    expect(haveFileOverlap(a, b)).toEqual(["src/y.ts", "src/z.ts"]);
  });

  it("should return empty array for empty inputs", () => {
    expect(haveFileOverlap([], [])).toEqual([]);
    expect(haveFileOverlap(["src/a.ts"], [])).toEqual([]);
    expect(haveFileOverlap([], ["src/b.ts"])).toEqual([]);
  });
});

describe("getInFlightFileMap", () => {
  it("should return empty map when no active locks", () => {
    const lockManager = { listActive: vi.fn(() => []) } as unknown as LockManager;
    const store = { getNodeById: vi.fn() } as unknown as SqliteStore;

    expect(getInFlightFileMap(store, lockManager).size).toBe(0);
  });

  it("should skip non-task locks", () => {
    const lockManager = {
      listActive: vi.fn(() => [
        { resourceId: "snapshot:123", resourceType: "snapshot", agentId: "agent_1",
          leaseToken: "t1", acquiredAt: "", expiresAt: "" },
      ]),
    } as unknown as LockManager;
    const store = { getNodeById: vi.fn() } as unknown as SqliteStore;

    expect(getInFlightFileMap(store, lockManager).size).toBe(0);
    expect((store.getNodeById as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("should map nodeId to Set<file> for task locks with touchedFiles", () => {
    const nodeId = "node_abc";
    const files = ["src/foo.ts", "src/bar.ts"];
    const lockManager = {
      listActive: vi.fn(() => [
        { resourceId: `task:${nodeId}`, resourceType: "task", agentId: "agent_1",
          leaseToken: "t1", acquiredAt: "", expiresAt: "" },
      ]),
    } as unknown as LockManager;
    const store = {
      getNodeById: vi.fn((id: string) =>
        id === nodeId ? buildNode({ id: nodeId, metadata: { touchedFiles: files } }) : null
      ),
    } as unknown as SqliteStore;

    const result = getInFlightFileMap(store, lockManager);

    expect(result.size).toBe(1);
    expect(result.get(nodeId)).toEqual(new Set(files));
  });

  it("should skip tasks whose node is not found in store", () => {
    const lockManager = {
      listActive: vi.fn(() => [
        { resourceId: "task:node_missing", resourceType: "task", agentId: "agent_1",
          leaseToken: "t1", acquiredAt: "", expiresAt: "" },
      ]),
    } as unknown as LockManager;
    const store = { getNodeById: vi.fn(() => null) } as unknown as SqliteStore;

    expect(getInFlightFileMap(store, lockManager).size).toBe(0);
  });

  it("should include tasks with no touchedFiles as empty Set", () => {
    const nodeId = "node_no_files";
    const lockManager = {
      listActive: vi.fn(() => [
        { resourceId: `task:${nodeId}`, resourceType: "task", agentId: "agent_1",
          leaseToken: "t1", acquiredAt: "", expiresAt: "" },
      ]),
    } as unknown as LockManager;
    const store = {
      getNodeById: vi.fn(() => buildNode({ id: nodeId, metadata: {} })),
    } as unknown as SqliteStore;

    const result = getInFlightFileMap(store, lockManager);

    expect(result.size).toBe(1);
    expect(result.get(nodeId)).toEqual(new Set());
  });
});
