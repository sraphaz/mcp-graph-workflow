/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { wrapToolsWithGates } from "../mcp/unified-gate.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

interface FakeRegisteredTool {
  handler: (...args: unknown[]) => Promise<unknown>;
}

interface FakeServer {
  _registeredTools: Record<string, FakeRegisteredTool>;
}

function makeServer(tools: Record<string, FakeRegisteredTool["handler"]>): FakeServer {
  return {
    _registeredTools: Object.fromEntries(
      Object.entries(tools).map(([name, handler]) => [name, { handler }]),
    ),
  };
}

describe("Unified-gate hooks — tool:pre-call / tool:post-call wrapping", () => {
  let store: SqliteStore;
  let bus: HookBus;
  let captured: HookEvent[];

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Unified Gate Hook Test");
    bus = new HookBus(new GraphEventBus());
    setSharedHookBus(bus);
    captured = [];
    bus.on("tool:pre-call", async (e) => { captured.push(e); });
    bus.on("tool:post-call", async (e) => { captured.push(e); });
  });

  afterEach(() => {
    store.close();
    setSharedHookBus(null);
  });

  it("emits tool:pre-call and tool:post-call when a mutating tool runs", async () => {
    const server = makeServer({
      add_node: async (args: unknown) => ({ content: [{ type: "text", text: "ok" }], _args: args }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wrapToolsWithGates(server as any, store);
    await server._registeredTools.add_node.handler({ type: "task", title: "t" });
    await flushMicrotasks();

    const pre = captured.find((e) => e.channel === "tool:pre-call");
    const post = captured.find((e) => e.channel === "tool:post-call");
    expect(pre?.payload.toolName).toBe("add_node");
    expect(pre?.payload.args).toEqual({ type: "task", title: "t" });
    expect(post?.payload.toolName).toBe("add_node");
    expect(typeof post?.payload.durationMs).toBe("number");
    expect(post?.payload.error).toBeUndefined();
  });

  it("skips hooks for read-only tools (list, show, query_graph, help)", async () => {
    const server = makeServer({
      list: async () => ({ content: [{ type: "text", text: "[]" }] }),
      show: async () => ({ content: [{ type: "text", text: "{}" }] }),
      query_graph: async () => ({ content: [{ type: "text", text: "[]" }] }),
      help: async () => ({ content: [{ type: "text", text: "" }] }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wrapToolsWithGates(server as any, store);
    await server._registeredTools.list.handler({});
    await server._registeredTools.show.handler({ id: "x" });
    await server._registeredTools.query_graph.handler({ sql: "SELECT 1" });
    await server._registeredTools.help.handler({});
    await flushMicrotasks();

    expect(captured).toHaveLength(0);
  });

  it("emits tool:post-call with error when the handler throws", async () => {
    const server = makeServer({
      add_node: async () => { throw new Error("boom"); },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wrapToolsWithGates(server as any, store);
    await expect(server._registeredTools.add_node.handler({})).rejects.toThrow("boom");
    await flushMicrotasks();

    const post = captured.find((e) => e.channel === "tool:post-call");
    expect(post?.payload.error).toBe("boom");
    expect(typeof post?.payload.durationMs).toBe("number");
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}
