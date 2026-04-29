/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-13.3 — task:pre-execute hook integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HookBus } from "../core/hooks/hook-bus.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";
import { logger } from "../core/utils/logger.js";

type WarnCall = [string, Record<string, unknown>?];

describe("anti-hallucination hook on task:pre-execute", () => {
  let bus: HookBus;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let prevDisabled: string | undefined;

  beforeEach(() => {
    prevDisabled = process.env.MCP_GRAPH_HOOKS_DISABLED;
    process.env.MCP_GRAPH_HOOKS_DISABLED = "false";
    bus = new HookBus(new GraphEventBus());
    registerBuiltinHandlers(bus);
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (prevDisabled === undefined) delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    else process.env.MCP_GRAPH_HOOKS_DISABLED = prevDisabled;
  });

  it("emits a warning when prompt contains banned phrases", async () => {
    await bus.emit({
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: {
        nodeId: "n1",
        prompt: "This is standard practice and typically works.",
      },
    });

    const matched = (warnSpy.mock.calls as WarnCall[]).find(
      (c) => String(c[0]).includes("anti-hallucination"),
    );
    expect(matched).toBeDefined();
    const ctx = matched?.[1] as { bannedPhrases: string[] } | undefined;
    expect(ctx?.bannedPhrases).toEqual(expect.arrayContaining(["standard practice", "typically"]));
  });

  it("stays silent when prompt is clean", async () => {
    await bus.emit({
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "n2", prompt: "uses §ADR-0049 retry policy" },
    });
    const matched = (warnSpy.mock.calls as WarnCall[]).find(
      (c) => String(c[0]).includes("anti-hallucination"),
    );
    expect(matched).toBeUndefined();
  });

  it("ignores events without a prompt field", async () => {
    await bus.emit({
      channel: "task:pre-execute",
      timestamp: new Date().toISOString(),
      payload: { nodeId: "n3" },
    });
    const matched = (warnSpy.mock.calls as WarnCall[]).find(
      (c) => String(c[0]).includes("anti-hallucination"),
    );
    expect(matched).toBeUndefined();
  });
});
