/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { AgentClaimManager } from "../core/swarm/agent-claim-manager.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

describe("Swarm hooks — agent:pre-spawn / agent:post-spawn", () => {
  let db: Database.Database;
  let claimManager: AgentClaimManager;
  let bus: HookBus;
  let captured: HookEvent[];

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    claimManager = new AgentClaimManager(db);
    bus = new HookBus(new GraphEventBus());
    setSharedHookBus(bus);
    captured = [];
    bus.on("agent:pre-spawn", async (e) => { captured.push(e); });
    bus.on("agent:post-spawn", async (e) => { captured.push(e); });
  });

  afterEach(() => {
    db.close();
    setSharedHookBus(null);
  });

  it("emits pre-spawn then post-spawn(success) when claim succeeds", async () => {
    claimManager.claim("task:abc", "agent-1");
    await flushMicrotasks();

    const pre = captured.find((e) => e.channel === "agent:pre-spawn");
    const post = captured.find((e) => e.channel === "agent:post-spawn");
    expect(pre?.payload.agentId).toBe("agent-1");
    expect(pre?.payload.resourceId).toBe("task:abc");
    expect(post?.payload.status).toBe("success");
    expect(post?.payload.agentId).toBe("agent-1");
  });

  it("emits pre-spawn then post-spawn(failure) with error when claim conflicts", async () => {
    claimManager.claim("task:dup", "agent-1");
    captured.length = 0; // ignore the first pair

    expect(() => claimManager.claim("task:dup", "agent-2")).toThrow(/already claimed/);
    await flushMicrotasks();

    const pre = captured.find((e) => e.channel === "agent:pre-spawn");
    const post = captured.find((e) => e.channel === "agent:post-spawn");
    expect(pre?.payload.agentId).toBe("agent-2");
    expect(post?.payload.status).toBe("failure");
    expect(typeof post?.payload.error).toBe("string");
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}
