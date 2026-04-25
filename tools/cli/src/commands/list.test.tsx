/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  resetParentBridgeForTests,
  setParentRuntimeForTests,
} from "../core/parent-bridge.js";
import { runList } from "./list.js";

interface FakeNode {
  id: string;
  type: string;
  status?: string;
  name?: string;
  priority?: number;
  blocked?: boolean;
  description?: string;
  tags?: string[];
}

function makeRuntime(nodes: FakeNode[]) {
  return {
    distRoot: "/fake",
    loadStore: async () => ({
      SqliteStore: {
        open: () => ({
          toGraphDocument: () => ({ nodes, edges: [] }),
          close: () => {},
        }),
      },
    }),
    loadPlanner: async () => ({}),
    loadGraphTypes: async () => ({}),
  };
}

const baseCtx = {
  args: [],
  flags: {} as Record<string, string | boolean>,
  mode: "shell" as const,
  traceId: "t",
};

describe("runList", () => {
  afterEach(() => {
    resetParentBridgeForTests();
  });

  it("hides done/cancelled by default", async () => {
    setParentRuntimeForTests(
      makeRuntime([
        { id: "a", type: "task", status: "backlog", name: "A" },
        { id: "b", type: "task", status: "done", name: "B" },
        { id: "c", type: "task", status: "cancelled", name: "C" },
      ]),
    );

    const result = await runList({ ...baseCtx, flags: { json: true } });
    expect(result.exitCode).toBe(0);
    const json = result.json as { total: number; nodes: { id: string }[] };
    expect(json.total).toBe(1);
    expect(json.nodes[0].id).toBe("a");
  });

  it("shows done when --all is passed", async () => {
    setParentRuntimeForTests(
      makeRuntime([
        { id: "a", type: "task", status: "backlog" },
        { id: "b", type: "task", status: "done" },
      ]),
    );

    const result = await runList({ ...baseCtx, flags: { all: true, json: true } });
    const json = result.json as { total: number };
    expect(json.total).toBe(2);
  });

  it("filters by --status", async () => {
    setParentRuntimeForTests(
      makeRuntime([
        { id: "a", type: "task", status: "backlog" },
        { id: "b", type: "task", status: "in_progress" },
        { id: "c", type: "task", status: "in_progress" },
      ]),
    );

    const result = await runList({
      ...baseCtx,
      flags: { status: "in_progress", json: true },
    });
    const json = result.json as { total: number };
    expect(json.total).toBe(2);
  });

  it("filters by --type", async () => {
    setParentRuntimeForTests(
      makeRuntime([
        { id: "a", type: "task", status: "backlog" },
        { id: "e", type: "epic", status: "backlog" },
      ]),
    );

    const result = await runList({
      ...baseCtx,
      flags: { type: "epic", json: true },
    });
    const json = result.json as { nodes: { id: string }[] };
    expect(json.nodes.map((n) => n.id)).toEqual(["e"]);
  });

  it("filters by --search across name/description/id/tags", async () => {
    setParentRuntimeForTests(
      makeRuntime([
        { id: "a", type: "task", status: "backlog", name: "fix auth bug" },
        { id: "b", type: "task", status: "backlog", description: "AUTH refactor" },
        { id: "c", type: "task", status: "backlog", tags: ["auth"] },
        { id: "d", type: "task", status: "backlog", name: "unrelated" },
      ]),
    );

    const result = await runList({
      ...baseCtx,
      flags: { search: "auth", json: true },
    });
    const json = result.json as { total: number; nodes: { id: string }[] };
    expect(json.total).toBe(3);
    expect(json.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("sorts in_progress before backlog, then by priority", async () => {
    setParentRuntimeForTests(
      makeRuntime([
        { id: "a", type: "task", status: "backlog", priority: 1 },
        { id: "b", type: "task", status: "in_progress", priority: 5 },
        { id: "c", type: "task", status: "backlog", priority: 2 },
      ]),
    );

    const result = await runList({ ...baseCtx, flags: { json: true } });
    const json = result.json as { nodes: { id: string }[] };
    expect(json.nodes.map((n) => n.id)).toEqual(["b", "a", "c"]);
  });

  it("respects --limit", async () => {
    setParentRuntimeForTests(
      makeRuntime(
        Array.from({ length: 50 }, (_, i) => ({
          id: `node_${i}`,
          type: "task",
          status: "backlog",
        })),
      ),
    );

    const result = await runList({
      ...baseCtx,
      flags: { limit: "5", json: true },
    });
    const json = result.json as { total: number; showing: number };
    expect(json.total).toBe(50);
    expect(json.showing).toBe(5);
  });

  it("renders empty-state element when no matches", async () => {
    setParentRuntimeForTests(makeRuntime([]));

    const result = await runList(baseCtx);
    expect(result.exitCode).toBe(0);
    expect(result.element).toBeDefined();
  });
});
