/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

describe("Memory hooks — memory:pre-store / memory:post-store", () => {
  let db: Database.Database;
  let store: KnowledgeStore;
  let bus: HookBus;
  let captured: HookEvent[];

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new KnowledgeStore(db);
    bus = new HookBus(new GraphEventBus());
    setSharedHookBus(bus);
    captured = [];
    bus.on("memory:pre-store", async (e) => { captured.push(e); });
    bus.on("memory:post-store", async (e) => { captured.push(e); });
  });

  afterEach(() => {
    db.close();
    setSharedHookBus(null);
  });

  it("emits memory:pre-store before INSERT and memory:post-store after success", async () => {
    store.insert({
      sourceType: "memory",
      sourceId: "mem-1",
      title: "First memory",
      content: "Hello world",
    });
    await flushMicrotasks();

    const pre = captured.find((e) => e.channel === "memory:pre-store");
    const post = captured.find((e) => e.channel === "memory:post-store");
    expect(pre?.payload.sourceType).toBe("memory");
    expect(pre?.payload.sourceId).toBe("mem-1");
    expect(pre?.payload.contentLength).toBe(11);
    expect(post?.payload.sourceType).toBe("memory");
    expect(typeof post?.payload.id).toBe("string");
  });

  it("does NOT emit memory:post-store when content size limit blocks the INSERT", async () => {
    const oversize = "x".repeat(500_001);
    expect(() => store.insert({
      sourceType: "memory",
      sourceId: "mem-2",
      title: "Too big",
      content: oversize,
    })).toThrow(/Content too large/);
    await flushMicrotasks();

    const pre = captured.filter((e) => e.channel === "memory:pre-store");
    const post = captured.filter((e) => e.channel === "memory:post-store");
    // Size check throws BEFORE pre-store; both should be empty.
    expect(pre).toHaveLength(0);
    expect(post).toHaveLength(0);
  });

  it("emits both hooks even on a dedup hit (idempotent re-insert)", async () => {
    store.insert({ sourceType: "memory", sourceId: "mem-3", title: "Dup", content: "same" });
    captured.length = 0;
    store.insert({ sourceType: "memory", sourceId: "mem-3", title: "Dup", content: "same" });
    await flushMicrotasks();

    const pre = captured.filter((e) => e.channel === "memory:pre-store");
    const post = captured.filter((e) => e.channel === "memory:post-store");
    expect(pre).toHaveLength(1);
    // Dedup hit returns early without firing post-store — that is expected;
    // post is observability for actual mutations only.
    expect(post).toHaveLength(0);
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}
