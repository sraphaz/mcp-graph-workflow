/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import {
  emitSessionStart,
  emitSessionEnd,
  installSessionEndHandlers,
  _resetSessionLifecycleForTesting,
} from "../core/hooks/session-lifecycle.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

describe("Session lifecycle hooks — session:start / session:end", () => {
  let bus: HookBus;
  let captured: HookEvent[];

  beforeEach(() => {
    bus = new HookBus(new GraphEventBus());
    setSharedHookBus(bus);
    captured = [];
    bus.on("session:start", async (e) => { captured.push(e); });
    bus.on("session:end", async (e) => { captured.push(e); });
    _resetSessionLifecycleForTesting();
  });

  afterEach(() => {
    setSharedHookBus(null);
    _resetSessionLifecycleForTesting();
  });

  it("emits session:start exactly once with uuid + ISO timestamp", async () => {
    emitSessionStart();
    emitSessionStart();
    emitSessionStart();
    await flushMicrotasks();

    const startEvents = captured.filter((e) => e.channel === "session:start");
    expect(startEvents).toHaveLength(1);
    expect(typeof startEvents[0].payload.sessionId).toBe("string");
    expect((startEvents[0].payload.sessionId as string).length).toBeGreaterThan(20);
    expect(typeof startEvents[0].timestamp).toBe("string");
    expect(new Date(startEvents[0].timestamp).toString()).not.toBe("Invalid Date");
  });

  it("emits session:end exactly once even when fired multiple times", async () => {
    emitSessionStart();
    expect(emitSessionEnd("SIGINT")).toBe(true);
    expect(emitSessionEnd("SIGTERM")).toBe(false);
    expect(emitSessionEnd("beforeExit")).toBe(false);
    await flushMicrotasks();

    const endEvents = captured.filter((e) => e.channel === "session:end");
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].payload.reason).toBe("SIGINT");
  });

  it("session:end carries the same sessionId as session:start", async () => {
    const id = emitSessionStart();
    emitSessionEnd("SIGTERM");
    await flushMicrotasks();

    const start = captured.find((e) => e.channel === "session:start");
    const end = captured.find((e) => e.channel === "session:end");
    expect(end?.payload.sessionId).toBe(id);
    expect(start?.payload.sessionId).toBe(id);
  });

  it("installSessionEndHandlers wires SIGINT / SIGTERM / SIGHUP / beforeExit", async () => {
    emitSessionStart();
    const fakeProc = new EventEmitter() as unknown as NodeJS.Process;
    const dispose = installSessionEndHandlers(fakeProc, ["SIGINT", "SIGTERM", "SIGHUP"]);

    fakeProc.emit("SIGINT");        // first one wins
    fakeProc.emit("SIGTERM");        // ignored (idempotency)
    fakeProc.emit("beforeExit", 0);  // ignored
    await flushMicrotasks();

    const endEvents = captured.filter((e) => e.channel === "session:end");
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].payload.reason).toBe("SIGINT");

    dispose();
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}
