/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Integration: registerBuiltinHandlers wires the verified-auto-promote
 * handler on task:post-complete when a store is provided. Closes the drift
 * gap between subtask completion and parent epic promotion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

function makeBus(): HookBus {
  const fakeGraphBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never;
  return new HookBus(fakeGraphBus);
}

function makeStore(): SqliteStore {
  const store = SqliteStore.openDb(":memory:");
  store.initProject("test");
  return store;
}

describe("verified-auto-promote hook wiring", () => {
  let tmpDir: string;
  let originalDisabled: string | undefined;
  let originalToggle: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "verified-hook-"));
    originalDisabled = process.env.MCP_GRAPH_HOOKS_DISABLED;
    originalToggle = process.env.MCP_GRAPH_VERIFIED_AUTO_PROMOTE;
    delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    delete process.env.MCP_GRAPH_VERIFIED_AUTO_PROMOTE;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalDisabled === undefined) delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    else process.env.MCP_GRAPH_HOOKS_DISABLED = originalDisabled;
    if (originalToggle === undefined) delete process.env.MCP_GRAPH_VERIFIED_AUTO_PROMOTE;
    else process.env.MCP_GRAPH_VERIFIED_AUTO_PROMOTE = originalToggle;
  });

  function fileIn(rel: string): string {
    const p = path.join(tmpDir, rel);
    writeFileSync(p, "// dummy", "utf-8");
    return p;
  }

  it("hook is registered and promotes parent on task:post-complete when verification passes", async () => {
    const store = makeStore();
    const src = fileIn("src.ts");
    const now = new Date().toISOString();

    store.insertNode({
      id: "epic",
      type: "epic",
      title: "E",
      status: "backlog",
      priority: 3,
      createdAt: now,
      updatedAt: now,
      sourceRef: { file: src, startLine: 1, endLine: 1, confidence: 1 },
    });
    store.insertNode({
      id: "s1",
      type: "subtask",
      title: "S1",
      status: "done",
      priority: 3,
      parentId: "epic",
      createdAt: now,
      updatedAt: now,
    });

    const bus = makeBus();
    registerBuiltinHandlers(bus, store);

    await bus.emit({
      channel: "task:post-complete",
      timestamp: now,
      payload: { nodeId: "s1" },
    });

    // Hook is fire-and-forget; await one microtask flush
    await new Promise((r) => setImmediate(r));

    expect(store.getNodeById("epic")?.status).toBe("done");
  });

  it("hook is no-op when store is not provided (backward compat)", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus); // no store
    // Should not throw, should not register the verified handler
    await bus.emit({
      channel: "task:post-complete",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "doesnt-matter" },
    });
    expect(true).toBe(true);
  });

  it("hook is skipped when MCP_GRAPH_VERIFIED_AUTO_PROMOTE=off", async () => {
    process.env.MCP_GRAPH_VERIFIED_AUTO_PROMOTE = "off";
    const store = makeStore();
    const now = new Date().toISOString();

    store.insertNode({
      id: "epic",
      type: "epic",
      title: "E",
      status: "backlog",
      priority: 3,
      createdAt: now,
      updatedAt: now,
    });
    store.insertNode({
      id: "s1",
      type: "subtask",
      title: "S1",
      status: "done",
      priority: 3,
      parentId: "epic",
      createdAt: now,
      updatedAt: now,
    });

    const bus = makeBus();
    registerBuiltinHandlers(bus, store);

    await bus.emit({
      channel: "task:post-complete",
      timestamp: now,
      payload: { nodeId: "s1" },
    });
    await new Promise((r) => setImmediate(r));

    expect(store.getNodeById("epic")?.status).toBe("backlog");
  });

  it("hook does not promote when verification rejects (no sourceRef + no testFiles → still ok; mismatch fails)", async () => {
    const store = makeStore();
    const now = new Date().toISOString();

    store.insertNode({
      id: "epic",
      type: "epic",
      title: "E",
      status: "backlog",
      priority: 3,
      createdAt: now,
      updatedAt: now,
      sourceRef: { file: path.join(tmpDir, "ghost.ts"), startLine: 1, endLine: 1, confidence: 1 },
    });
    store.insertNode({
      id: "s1",
      type: "subtask",
      title: "S1",
      status: "done",
      priority: 3,
      parentId: "epic",
      createdAt: now,
      updatedAt: now,
    });

    const bus = makeBus();
    registerBuiltinHandlers(bus, store);

    await bus.emit({
      channel: "task:post-complete",
      timestamp: now,
      payload: { nodeId: "s1" },
    });
    await new Promise((r) => setImmediate(r));

    expect(store.getNodeById("epic")?.status).toBe("backlog");
  });

  it("hook ignores events with empty/missing nodeId payload", async () => {
    const store = makeStore();
    const bus = makeBus();
    registerBuiltinHandlers(bus, store);

    // Should not throw
    await bus.emit({
      channel: "task:post-complete",
      timestamp: new Date().toISOString(),
      payload: {},
    });
    await new Promise((r) => setImmediate(r));
    expect(true).toBe(true);
  });
});
