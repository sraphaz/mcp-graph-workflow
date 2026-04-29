/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

function makeEvent(channel: HookEvent["channel"]): HookEvent {
  return { channel, timestamp: new Date().toISOString(), payload: { nodeId: "n1" } };
}

describe("HookBus", () => {
  let graphBus: GraphEventBus;
  let hookBus: HookBus;

  beforeEach(() => {
    graphBus = new GraphEventBus();
    hookBus = new HookBus(graphBus);
  });

  it("emits to a subscribed async handler", async () => {
    const calls: HookEvent[] = [];
    hookBus.on("task:pre-execute", async (e) => { calls.push(e); });
    await hookBus.emit(makeEvent("task:pre-execute"));
    expect(calls).toHaveLength(1);
    expect(calls[0].channel).toBe("task:pre-execute");
  });

  it("does not call handlers for a different channel", async () => {
    const calls: HookEvent[] = [];
    hookBus.on("session:start", async (e) => { calls.push(e); });
    await hookBus.emit(makeEvent("tool:pre-call"));
    expect(calls).toHaveLength(0);
  });

  it("calls multiple handlers on the same channel in order", async () => {
    const order: number[] = [];
    hookBus.on("tool:pre-call", async () => { order.push(1); });
    hookBus.on("tool:pre-call", async () => { order.push(2); });
    await hookBus.emit(makeEvent("tool:pre-call"));
    expect(order).toEqual([1, 2]);
  });

  it("off() removes a handler", async () => {
    const calls: HookEvent[] = [];
    const handler = async (e: HookEvent) => { calls.push(e); };
    hookBus.on("agent:pre-spawn", handler);
    hookBus.off("agent:pre-spawn", handler);
    await hookBus.emit(makeEvent("agent:pre-spawn"));
    expect(calls).toHaveLength(0);
  });

  it("delegates to GraphEventBus (existing consumers unaffected)", () => {
    const graphEvents: string[] = [];
    graphBus.on("node:created", (e) => { graphEvents.push(e.type); });
    graphBus.emitTyped("node:created", { nodeId: "x", title: "t", nodeType: "task" });
    expect(graphEvents).toEqual(["node:created"]);
  });

  it("hook emissions do not bleed into GraphEventBus graph events", async () => {
    const graphCalls: string[] = [];
    graphBus.on("*", (e) => { graphCalls.push(e.type); });
    await hookBus.emit(makeEvent("swarm:consensus-reached"));
    expect(graphCalls).toHaveLength(0);
  });

  it("returns handler count per channel", () => {
    hookBus.on("memory:pre-store", async () => {});
    hookBus.on("memory:pre-store", async () => {});
    expect(hookBus.listenerCount("memory:pre-store")).toBe(2);
    expect(hookBus.listenerCount("memory:post-store")).toBe(0);
  });
});
