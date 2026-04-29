/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HookRegistry } from "../core/hooks/hook-registry.js";
import { HookTimeoutError, HookCircuitOpenError } from "../core/hooks/hook-types.js";
import type { HookEvent, HookRegistration } from "../core/hooks/hook-types.js";

function makeEvent(channel: HookEvent["channel"] = "task:pre-execute"): HookEvent {
  return { channel, timestamp: new Date().toISOString(), payload: {} };
}

function makeReg(
  id: string,
  handler: HookRegistration["handler"],
  priority = 0,
): HookRegistration {
  return { id, channel: "task:pre-execute", handler, priority };
}

describe("HookRegistry", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new HookRegistry({ timeoutMs: 50, windowMs: 60_000, maxFailures: 3 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls a registered handler on dispatch", async () => {
    const calls: HookEvent[] = [];
    registry.register(makeReg("h1", async (e) => { calls.push(e); }));
    await registry.dispatch(makeEvent());
    expect(calls).toHaveLength(1);
  });

  it("calls handlers in priority order (lower number = higher priority)", async () => {
    const order: string[] = [];
    registry.register(makeReg("low", async () => { order.push("low"); }, 10));
    registry.register(makeReg("high", async () => { order.push("high"); }, 1));
    await registry.dispatch(makeEvent());
    expect(order).toEqual(["high", "low"]);
  });

  it("unregister removes the handler", async () => {
    const calls: HookEvent[] = [];
    registry.register(makeReg("h1", async (e) => { calls.push(e); }));
    registry.unregister("h1");
    await registry.dispatch(makeEvent());
    expect(calls).toHaveLength(0);
  });

  it("throws HookTimeoutError when handler exceeds timeoutMs", async () => {
    registry.register(
      makeReg("slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }),
    );
    const dispatchPromise = registry.dispatch(makeEvent());
    vi.advanceTimersByTime(100);
    await expect(dispatchPromise).rejects.toBeInstanceOf(HookTimeoutError);
  });

  it("auto-disables handler after maxFailures timeouts in window", async () => {
    const calls: HookEvent[] = [];
    registry.register(
      makeReg("flaky", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }),
    );

    for (let i = 0; i < 3; i++) {
      const p = registry.dispatch(makeEvent());
      vi.advanceTimersByTime(100);
      await expect(p).rejects.toBeInstanceOf(HookTimeoutError);
    }

    const p2 = registry.dispatch(makeEvent());
    vi.advanceTimersByTime(100);
    await expect(p2).rejects.toBeInstanceOf(HookCircuitOpenError);

    expect(calls).toHaveLength(0);
  });

  it("circuit resets after windowMs elapses", async () => {
    registry.register(
      makeReg("flaky", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }),
    );
    for (let i = 0; i < 3; i++) {
      const p = registry.dispatch(makeEvent());
      vi.advanceTimersByTime(100);
      await p.catch(() => {});
    }

    vi.advanceTimersByTime(60_001);

    const calls: HookEvent[] = [];
    registry.unregister("flaky");
    registry.register(makeReg("flaky", async (e) => { calls.push(e); }));
    await registry.dispatch(makeEvent());
    expect(calls).toHaveLength(1);
  });

  it("list() returns registered ids", () => {
    registry.register(makeReg("h1", async () => {}));
    registry.register(makeReg("h2", async () => {}));
    expect(registry.list()).toContain("h1");
    expect(registry.list()).toContain("h2");
  });
});
