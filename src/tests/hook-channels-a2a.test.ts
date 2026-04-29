/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication (E20.T01).
 * HookChannel must include agent P2P channels so the bus can route
 * direct agent-to-agent messages without round-tripping the graph.
 */

import { describe, it, expect } from "vitest";
import {
  HOOK_CHANNELS,
  HookChannelSchema,
  HookEventSchema,
} from "../core/hooks/hook-types.js";

describe("HookChannel enum extended for A2A (E20.T01)", () => {
  it("HOOK_CHANNELS includes agent:p2p-send", () => {
    expect(HOOK_CHANNELS).toContain("agent:p2p-send");
  });

  it("HOOK_CHANNELS includes agent:p2p-receive", () => {
    expect(HOOK_CHANNELS).toContain("agent:p2p-receive");
  });

  it("HOOK_CHANNELS includes agent:p2p-ack", () => {
    expect(HOOK_CHANNELS).toContain("agent:p2p-ack");
  });

  it("HookChannelSchema accepts each new agent P2P channel", () => {
    expect(HookChannelSchema.safeParse("agent:p2p-send").success).toBe(true);
    expect(HookChannelSchema.safeParse("agent:p2p-receive").success).toBe(true);
    expect(HookChannelSchema.safeParse("agent:p2p-ack").success).toBe(true);
  });

  it("HookChannelSchema rejects unknown agent:p2p-* values", () => {
    expect(HookChannelSchema.safeParse("agent:p2p-unknown").success).toBe(false);
  });

  it("HookEvent with agent P2P channel parses successfully", () => {
    const result = HookEventSchema.safeParse({
      channel: "agent:p2p-send",
      timestamp: "2026-04-29T00:00:00Z",
      payload: { from: "a1", to: "a2", body: "ping" },
    });
    expect(result.success).toBe(true);
  });

  it("Pre-existing channels remain present (no regression)", () => {
    for (const ch of [
      "session:start",
      "task:pre-execute",
      "swarm:consensus-reached",
      "approval:required",
    ]) {
      expect(HOOK_CHANNELS).toContain(ch);
    }
  });
});
