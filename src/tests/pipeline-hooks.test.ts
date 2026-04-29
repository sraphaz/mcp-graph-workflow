/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { startTask } from "../core/pipeline/start-task.js";
import { finishTask } from "../core/pipeline/finish-task.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus, getSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";
import { makeNode } from "./helpers/factories.js";

describe("Pipeline hooks — task:pre-execute / task:post-complete / task:error", () => {
  let store: SqliteStore;
  let bus: HookBus;
  let captured: HookEvent[];

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Pipeline Hooks Test");
    bus = new HookBus(new GraphEventBus());
    setSharedHookBus(bus);
    captured = [];
    bus.on("task:pre-execute", async (e) => { captured.push(e); });
    bus.on("task:post-complete", async (e) => { captured.push(e); });
    bus.on("task:error", async (e) => { captured.push(e); });
  });

  afterEach(() => {
    store.close();
    setSharedHookBus(null);
  });

  it("emits task:pre-execute when startTask transitions a node to in_progress", async () => {
    const node = makeNode({ id: "t-pre", status: "backlog", title: "Pre-execute test" });
    store.insertNode(node);

    startTask(store, { nodeId: "t-pre" });
    await flushMicrotasks();

    const pre = captured.find((e) => e.channel === "task:pre-execute");
    expect(pre).toBeDefined();
    expect(pre?.payload.nodeId).toBe("t-pre");
    expect(typeof pre?.timestamp).toBe("string");
  });

  it("emits task:post-complete when finishTask successfully marks a node done", async () => {
    const node = makeNode({
      id: "t-post",
      status: "in_progress",
      title: "Post-complete test",
      acceptanceCriteria: ["should output the expected result"],
    });
    store.insertNode(node);

    await finishTask(store, "t-post", { rationale: "happy path" });
    await flushMicrotasks();

    const post = captured.find((e) => e.channel === "task:post-complete");
    expect(post).toBeDefined();
    expect(post?.payload.nodeId).toBe("t-post");
  });

  it("emits task:error when finishTask cannot mark a node done (DoD blocked)", async () => {
    const node = makeNode({
      id: "t-err",
      status: "backlog",  // missing in_progress transition → DoD status_flow_valid fails
      title: "Error test",
    });
    store.insertNode(node);

    await finishTask(store, "t-err", { rationale: "should be blocked" });
    await flushMicrotasks();

    const err = captured.find((e) => e.channel === "task:error");
    expect(err).toBeDefined();
    expect(err?.payload.nodeId).toBe("t-err");
    expect(typeof err?.payload.error).toBe("string");
  });

  it("getSharedHookBus returns the override set in beforeEach", () => {
    expect(getSharedHookBus()).toBe(bus);
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}
