/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  HookChannelSchema,
  HookEventSchema,
  HookHandlerSchema,
  HookRegistrationSchema,
  HOOK_CHANNELS,
  type HookChannel,
  type HookEvent,
  type HookHandler,
  type HookRegistration,
} from "../core/hooks/hook-types.js";

describe("hook-types", () => {
  it("exports exactly 16 channel keys", () => {
    expect(HOOK_CHANNELS).toHaveLength(16);
  });

  it("covers all 6 domains: session, agent, task, tool, memory, swarm", () => {
    const domains = new Set(HOOK_CHANNELS.map((c) => c.split(":")[0]));
    expect(domains).toContain("session");
    expect(domains).toContain("agent");
    expect(domains).toContain("task");
    expect(domains).toContain("tool");
    expect(domains).toContain("memory");
    expect(domains).toContain("swarm");
  });

  it("HookChannelSchema validates all 12 channels", () => {
    for (const ch of HOOK_CHANNELS) {
      expect(HookChannelSchema.safeParse(ch).success).toBe(true);
    }
  });

  it("HookChannelSchema rejects unknown channels", () => {
    expect(HookChannelSchema.safeParse("unknown:event").success).toBe(false);
  });

  it("HookEventSchema validates a well-formed event", () => {
    const event = {
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "node_abc" },
    };
    const result = HookEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("HookEventSchema rejects missing timestamp", () => {
    const result = HookEventSchema.safeParse({
      channel: "tool:pre-call",
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("HookHandlerSchema validates an async function", () => {
    const handler = async (_event: HookEvent) => {};
    const result = HookHandlerSchema.safeParse(handler);
    expect(result.success).toBe(true);
  });

  it("HookHandlerSchema rejects a sync function", () => {
    const syncFn = (_event: HookEvent) => {};
    const result = HookHandlerSchema.safeParse(syncFn);
    expect(result.success).toBe(false);
  });

  it("HookRegistrationSchema validates a complete registration", () => {
    const reg = {
      id: "reg-001",
      channel: "session:start",
      handler: async (_e: HookEvent) => {},
      priority: 10,
    };
    const result = HookRegistrationSchema.safeParse(reg);
    expect(result.success).toBe(true);
  });

  it("HookRegistrationSchema uses default priority 0 when omitted", () => {
    const reg = {
      id: "reg-002",
      channel: "agent:pre-spawn",
      handler: async (_e: HookEvent) => {},
    };
    const result = HookRegistrationSchema.safeParse(reg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(0);
    }
  });

  it("z.infer produces correct TypeScript types at the value level", () => {
    const ch: HookChannel = "swarm:consensus-reached";
    const event: HookEvent = {
      channel: ch,
      timestamp: new Date().toISOString(),
      payload: {},
    };
    const handler: HookHandler = async (_e) => {};
    const reg: HookRegistration = { id: "r", channel: ch, handler, priority: 5 };
    expect(event.channel).toBe("swarm:consensus-reached");
    expect(reg.priority).toBe(5);
  });
});
