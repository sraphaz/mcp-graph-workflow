/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { withToolHooks } from "../core/hooks/tool-hook-wrapper.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

describe("withToolHooks", () => {
  let hookBus: HookBus;
  let preEvents: HookEvent[];
  let postEvents: HookEvent[];

  beforeEach(() => {
    hookBus = new HookBus(new GraphEventBus());
    preEvents = [];
    postEvents = [];
    hookBus.on("tool:pre-call", async (e) => { preEvents.push(e); });
    hookBus.on("tool:post-call", async (e) => { postEvents.push(e); });
  });

  it("emits tool:pre-call before handler runs", async () => {
    const log: string[] = [];
    const handler = async () => { log.push("handler"); return { content: [] }; };
    const wrapped = withToolHooks("my_tool", handler, hookBus);
    hookBus.on("tool:pre-call", async () => { log.push("pre"); });
    await wrapped({ foo: "bar" });
    expect(log[0]).toBe("pre");
    expect(log[1]).toBe("handler");
  });

  it("emits tool:post-call after handler runs", async () => {
    const log: string[] = [];
    const handler = async () => { log.push("handler"); return { content: [] }; };
    const wrapped = withToolHooks("my_tool", handler, hookBus);
    hookBus.on("tool:post-call", async () => { log.push("post"); });
    await wrapped({});
    expect(log[0]).toBe("handler");
    expect(log[1]).toBe("post");
  });

  it("pre-call payload contains toolName and args", async () => {
    const wrapped = withToolHooks("analyze", async () => ({ content: [] }), hookBus);
    await wrapped({ mode: "sprint_health" });
    expect(preEvents[0].payload.toolName).toBe("analyze");
    expect(preEvents[0].payload.args).toMatchObject({ mode: "sprint_health" });
  });

  it("post-call payload contains toolName and durationMs", async () => {
    const wrapped = withToolHooks("analyze", async () => ({ content: [] }), hookBus);
    await wrapped({});
    expect(postEvents[0].payload.toolName).toBe("analyze");
    expect(typeof postEvents[0].payload.durationMs).toBe("number");
  });

  it("returns original handler result unchanged", async () => {
    const expected = { content: [{ type: "text", text: "ok" }] };
    const wrapped = withToolHooks("my_tool", async () => expected, hookBus);
    const result = await wrapped({});
    expect(result).toBe(expected);
  });

  it("still emits post-call even when handler throws", async () => {
    const handler = async () => { throw new Error("boom"); };
    const wrapped = withToolHooks("my_tool", handler, hookBus);
    await expect(wrapped({})).rejects.toThrow("boom");
    expect(postEvents).toHaveLength(1);
    expect(postEvents[0].payload.error).toBe("boom");
  });
});
