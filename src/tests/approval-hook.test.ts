/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-15.2 — APPROVAL_REQUIRED hook integration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HookBus } from "../core/hooks/hook-bus.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";

describe("approval:required hook on tool:pre-call", () => {
  let bus: HookBus;
  let prevDisabled: string | undefined;

  beforeEach(() => {
    prevDisabled = process.env.MCP_GRAPH_HOOKS_DISABLED;
    process.env.MCP_GRAPH_HOOKS_DISABLED = "false";
    bus = new HookBus(new GraphEventBus());
    registerBuiltinHandlers(bus);
  });

  afterEach(() => {
    if (prevDisabled === undefined) delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    else process.env.MCP_GRAPH_HOOKS_DISABLED = prevDisabled;
  });

  it("emits approval:required when tool input matches sensitive pattern", async () => {
    const captured: Array<Record<string, unknown>> = [];
    bus.on("approval:required", async (e) => {
      captured.push(e.payload);
    });

    await bus.emit({
      channel: "tool:pre-call",
      timestamp: new Date().toISOString(),
      payload: {
        toolName: "Bash",
        toolInput: { command: "rm -rf /" },
        nodeId: "task_1",
      },
    });

    expect(captured.length).toBe(1);
    expect(captured[0]?.severity).toBe("critical");
    expect(captured[0]?.tool).toBe("Bash");
  });

  it("stays silent on harmless tool calls", async () => {
    const captured: Array<unknown> = [];
    bus.on("approval:required", async () => { captured.push(1); });

    await bus.emit({
      channel: "tool:pre-call",
      timestamp: new Date().toISOString(),
      payload: { toolName: "Bash", toolInput: { command: "ls -la" } },
    });

    expect(captured.length).toBe(0);
  });

  it("emits high severity for npm publish", async () => {
    const captured: Array<Record<string, unknown>> = [];
    bus.on("approval:required", async (e) => { captured.push(e.payload); });

    await bus.emit({
      channel: "tool:pre-call",
      timestamp: new Date().toISOString(),
      payload: { toolName: "Bash", toolInput: { command: "npm publish" } },
    });

    expect(captured[0]?.severity).toBe("high");
  });
});
