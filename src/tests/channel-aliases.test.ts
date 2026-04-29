/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-INTEGRATION 5.1 — channel-aliases tests.
 */

import { describe, it, expect } from "vitest";
import {
  CLAUDE_CODE_ALIASES,
  resolveChannel,
} from "../core/hooks/channel-aliases.js";
import { HOOK_CHANNELS } from "../core/hooks/hook-types.js";

describe("channel-aliases (HOOKS 5.1)", () => {
  it("resolves Claude Code PascalCase events to mcp-graph channels", () => {
    expect(resolveChannel("PreToolUse")).toBe("tool:pre-call");
    expect(resolveChannel("PostToolUse")).toBe("tool:post-call");
    expect(resolveChannel("SessionStart")).toBe("session:start");
    expect(resolveChannel("SessionEnd")).toBe("session:end");
    expect(resolveChannel("Stop")).toBe("task:post-complete");
    expect(resolveChannel("SubagentStop")).toBe("agent:post-spawn");
    expect(resolveChannel("UserPromptSubmit")).toBe("task:pre-execute");
  });

  it("returns null for Claude Code events with no mcp-graph analog", () => {
    expect(resolveChannel("Notification")).toBeNull();
    expect(resolveChannel("PreCompact")).toBeNull();
  });

  it("passes through native mcp-graph channels untouched", () => {
    expect(resolveChannel("tool:pre-call")).toBe("tool:pre-call");
    expect(resolveChannel("agent:pre-spawn")).toBe("agent:pre-spawn");
    expect(resolveChannel("swarm:consensus-reached")).toBe("swarm:consensus-reached");
  });

  it("returns null for unknown strings", () => {
    expect(resolveChannel("not-a-channel")).toBeNull();
    expect(resolveChannel("")).toBeNull();
  });

  it("every non-null Claude Code alias maps to a member of HOOK_CHANNELS", () => {
    const known = new Set<string>(HOOK_CHANNELS);
    for (const [event, channel] of Object.entries(CLAUDE_CODE_ALIASES)) {
      if (channel === null) continue;
      expect(known.has(channel), `alias for ${event} should be a valid HookChannel`).toBe(true);
    }
  });

  it("HOOK_CHANNELS includes the 12 v2 taxonomy entries (extras allowed for later epics)", () => {
    const required = [
      "session:start",
      "session:end",
      "agent:pre-spawn",
      "agent:post-spawn",
      "task:pre-execute",
      "task:post-complete",
      "task:error",
      "tool:pre-call",
      "tool:post-call",
      "memory:pre-store",
      "memory:post-store",
      "swarm:consensus-reached",
    ];
    for (const ch of required) {
      expect(HOOK_CHANNELS).toContain(ch);
    }
  });
});
