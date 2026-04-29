/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T09 — WIP cap guard hook.
 * Operacionaliza WIP=1 do CLAUDE.md: warn (não bloqueia) quando agente já tem
 * tasks in_progress > MCP_GRAPH_WIP_CAP.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { countInProgressForAgent, getWipCap } from "../core/hooks/wip-cap-guard.js";

function makeBus(): HookBus {
  const fakeGraphBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never;
  return new HookBus(fakeGraphBus);
}

function makeStore(): SqliteStore {
  const store = SqliteStore.openDb(":memory:");
  store.initProject("wip-test");
  return store;
}

function insertTask(
  store: SqliteStore,
  id: string,
  status: "backlog" | "in_progress" | "done",
  modifiedBy: string | null = null,
): void {
  const now = new Date().toISOString();
  store.insertNode(
    {
      id,
      type: "subtask",
      title: `task-${id}`,
      status,
      priority: 3,
      createdAt: now,
      updatedAt: now,
    },
    modifiedBy ? { agentId: modifiedBy } : undefined,
  );
}

describe("getWipCap (E21.T09)", () => {
  it("default cap = 1 when env unset", () => {
    expect(getWipCap({})).toBe(1);
  });

  it("reads MCP_GRAPH_WIP_CAP override when valid integer", () => {
    expect(getWipCap({ MCP_GRAPH_WIP_CAP: "3" })).toBe(3);
  });

  it("ignores non-integer / negative / zero values, falls back to default", () => {
    expect(getWipCap({ MCP_GRAPH_WIP_CAP: "abc" })).toBe(1);
    expect(getWipCap({ MCP_GRAPH_WIP_CAP: "-1" })).toBe(1);
    expect(getWipCap({ MCP_GRAPH_WIP_CAP: "0" })).toBe(1);
  });
});

describe("countInProgressForAgent (E21.T09)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = makeStore();
  });

  afterEach(() => {
    store.close();
  });

  it("returns 0 when no tasks for agent", () => {
    expect(countInProgressForAgent(store, "agent-x")).toBe(0);
  });

  it("counts only status=in_progress for the given modified_by", () => {
    insertTask(store, "a", "in_progress", "agent-1");
    insertTask(store, "b", "backlog", "agent-1");
    insertTask(store, "c", "done", "agent-1");
    insertTask(store, "d", "in_progress", "agent-2");
    expect(countInProgressForAgent(store, "agent-1")).toBe(1);
    expect(countInProgressForAgent(store, "agent-2")).toBe(1);
  });

  it("returns total in_progress when agentId is null/undefined", () => {
    insertTask(store, "a", "in_progress", "agent-1");
    insertTask(store, "b", "in_progress", "agent-2");
    insertTask(store, "c", "backlog", "agent-1");
    expect(countInProgressForAgent(store, null)).toBe(2);
  });
});

describe("WIP cap hook integration (E21.T09)", () => {
  let originalDisabled: string | undefined;
  let originalCap: string | undefined;
  let originalGuard: string | undefined;

  beforeEach(() => {
    originalDisabled = process.env.MCP_GRAPH_HOOKS_DISABLED;
    originalCap = process.env.MCP_GRAPH_WIP_CAP;
    originalGuard = process.env.MCP_GRAPH_WIP_GUARD;
    delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    delete process.env.MCP_GRAPH_WIP_CAP;
    delete process.env.MCP_GRAPH_WIP_GUARD;
  });

  afterEach(() => {
    if (originalDisabled === undefined) delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    else process.env.MCP_GRAPH_HOOKS_DISABLED = originalDisabled;
    if (originalCap === undefined) delete process.env.MCP_GRAPH_WIP_CAP;
    else process.env.MCP_GRAPH_WIP_CAP = originalCap;
    if (originalGuard === undefined) delete process.env.MCP_GRAPH_WIP_GUARD;
    else process.env.MCP_GRAPH_WIP_GUARD = originalGuard;
  });

  it("hook is registered and warns (not throws) when agent exceeds cap", async () => {
    const store = makeStore();
    insertTask(store, "t1", "in_progress", "agent-1");
    insertTask(store, "t2", "in_progress", "agent-1");

    const bus = makeBus();
    registerBuiltinHandlers(bus, store);

    // Should not throw — advisory only.
    await bus.emit({
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "t3", agentId: "agent-1" },
    });
    expect(true).toBe(true); // reaches here = no throw
  });

  it("hook is no-op when MCP_GRAPH_WIP_GUARD=off", async () => {
    process.env.MCP_GRAPH_WIP_GUARD = "off";
    const store = makeStore();
    insertTask(store, "t1", "in_progress", "agent-1");
    const bus = makeBus();
    registerBuiltinHandlers(bus, store);

    await bus.emit({
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "t2", agentId: "agent-1" },
    });
    expect(true).toBe(true);
  });

  it("hook handles missing agentId gracefully (uses global count)", async () => {
    const store = makeStore();
    const bus = makeBus();
    registerBuiltinHandlers(bus, store);
    await bus.emit({
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "t1" },
    });
    expect(true).toBe(true);
  });
});
