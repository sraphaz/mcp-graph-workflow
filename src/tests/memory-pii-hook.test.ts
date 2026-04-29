/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T05 — Memory PII scanner hook integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";
import { HookBus } from "../core/hooks/hook-bus.js";

function makeBus(): HookBus {
  const fakeGraphBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never;
  return new HookBus(fakeGraphBus);
}

describe("memory:pre-store PII scanner hook (E21.T05)", () => {
  let originalDisabled: string | undefined;
  let originalStrict: string | undefined;
  let originalScanner: string | undefined;

  beforeEach(() => {
    originalDisabled = process.env.MCP_GRAPH_HOOKS_DISABLED;
    originalStrict = process.env.MCP_GRAPH_PII_STRICT;
    originalScanner = process.env.MCP_GRAPH_PII_SCANNER;
    delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    delete process.env.MCP_GRAPH_PII_STRICT;
    delete process.env.MCP_GRAPH_PII_SCANNER;
  });

  afterEach(() => {
    if (originalDisabled === undefined) delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    else process.env.MCP_GRAPH_HOOKS_DISABLED = originalDisabled;
    if (originalStrict === undefined) delete process.env.MCP_GRAPH_PII_STRICT;
    else process.env.MCP_GRAPH_PII_STRICT = originalStrict;
    if (originalScanner === undefined) delete process.env.MCP_GRAPH_PII_SCANNER;
    else process.env.MCP_GRAPH_PII_SCANNER = originalScanner;
  });

  it("redacts PII in payload.content by default", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);

    const event = {
      channel: "memory:pre-store" as const,
      timestamp: new Date().toISOString(),
      payload: { content: "user@example.com is the contact" },
    };
    await bus.emit(event);

    expect(event.payload.content).toBe("[REDACTED-EMAIL] is the contact");
  });

  it("strict mode (MCP_GRAPH_PII_STRICT=true) sets payload.rejected for caller-side abort", async () => {
    process.env.MCP_GRAPH_PII_STRICT = "true";
    const bus = makeBus();
    registerBuiltinHandlers(bus);

    const event = {
      channel: "memory:pre-store" as const,
      timestamp: new Date().toISOString(),
      payload: { content: "ssn 123-45-6789" } as Record<string, unknown>,
    };
    await bus.emit(event);

    expect(event.payload.rejected).toBe(true);
    expect(event.payload.rejectionReason).toMatch(/PII detected/);
    // Content NOT redacted in strict mode — caller must reject the store wholesale.
    expect(event.payload.content).toBe("ssn 123-45-6789");
  });

  it("is no-op when MCP_GRAPH_PII_SCANNER=off", async () => {
    process.env.MCP_GRAPH_PII_SCANNER = "off";
    const bus = makeBus();
    registerBuiltinHandlers(bus);

    const event = {
      channel: "memory:pre-store" as const,
      timestamp: new Date().toISOString(),
      payload: { content: "user@example.com here" },
    };
    await bus.emit(event);

    expect(event.payload.content).toBe("user@example.com here"); // unchanged
  });

  it("does nothing when payload has no content field", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);

    const event = {
      channel: "memory:pre-store" as const,
      timestamp: new Date().toISOString(),
      payload: { someOtherField: "x" },
    };
    await bus.emit(event); // should not throw
    expect(true).toBe(true);
  });

  it("does nothing when content has no PII", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);

    const event = {
      channel: "memory:pre-store" as const,
      timestamp: new Date().toISOString(),
      payload: { content: "perfectly clean text" },
    };
    await bus.emit(event);
    expect(event.payload.content).toBe("perfectly clean text");
  });

  it("redacts multiple PII types in one payload", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);

    const event = {
      channel: "memory:pre-store" as const,
      timestamp: new Date().toISOString(),
      payload: { content: "a@b.com 123-45-6789 done" },
    };
    await bus.emit(event);

    expect(event.payload.content).toBe("[REDACTED-EMAIL] [REDACTED-SSN] done");
  });
});
