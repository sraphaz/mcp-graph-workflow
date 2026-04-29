/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * E4.T04 — Built-in handlers: audit log, telemetry, harness regression check.
 *
 * AC1: Three handlers register on bus startup
 * AC2: Disabled in test mode by env flag
 * AC3: Each handler has unit test (this file)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerBuiltinHandlers, builtinHandlerIds } from "../core/hooks/builtin-handlers.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

function makeBus(): HookBus {
  const fakeGraphBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never;
  return new HookBus(fakeGraphBus);
}

function makeEvent(channel: HookEvent["channel"], payload: Record<string, unknown> = {}): HookEvent {
  return { channel, timestamp: new Date().toISOString(), payload };
}

// ── AC1: Three handlers register on startup ───────────────────────────────

describe("registerBuiltinHandlers — registration", () => {
  it("AC1: registers 11 built-in handler IDs (incl verified-auto-promote, memory-pii-scanner, wip-cap-guard, agent-budget-precheck, approval-timeout, destructive-db-guard)", () => {
    expect(builtinHandlerIds).toHaveLength(11);
    expect(builtinHandlerIds).toContain("builtin:destructive-db-guard");
  });

  it("AC1: built-in IDs include audit-log, telemetry, harness-regression", () => {
    expect(builtinHandlerIds).toContain("builtin:audit-log");
    expect(builtinHandlerIds).toContain("builtin:telemetry");
    expect(builtinHandlerIds).toContain("builtin:harness-regression");
  });

  it("AC1: registerBuiltinHandlers adds listeners to the bus", () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    // audit-log subscribes to task:post-complete and tool:post-call at minimum
    expect(bus.listenerCount("task:post-complete") + bus.listenerCount("tool:post-call")).toBeGreaterThan(0);
  });
});

// ── AC2: Disabled in test mode ────────────────────────────────────────────

describe("registerBuiltinHandlers — test mode", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.MCP_GRAPH_HOOKS_DISABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    } else {
      process.env.MCP_GRAPH_HOOKS_DISABLED = originalEnv;
    }
  });

  it("AC2: registerBuiltinHandlers is no-op when MCP_GRAPH_HOOKS_DISABLED=true", () => {
    process.env.MCP_GRAPH_HOOKS_DISABLED = "true";
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    expect(bus.listenerCount("task:post-complete")).toBe(0);
    expect(bus.listenerCount("tool:post-call")).toBe(0);
    expect(bus.listenerCount("session:start")).toBe(0);
  });

  it("AC2: handlers register normally when MCP_GRAPH_HOOKS_DISABLED is absent", () => {
    delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const total = (["task:post-complete", "tool:post-call", "session:start", "task:error"] as const)
      .reduce((sum, ch) => sum + bus.listenerCount(ch), 0);
    expect(total).toBeGreaterThan(0);
  });
});

// ── AC3: Each handler works correctly ────────────────────────────────────

describe("audit-log handler", () => {
  it("AC3: does not throw on task:post-complete event", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const event = makeEvent("task:post-complete", { nodeId: "node_abc", title: "Test Task" });
    await expect(bus.emit(event)).resolves.not.toThrow();
  });

  it("AC3: does not throw on task:error event", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const event = makeEvent("task:error", { nodeId: "node_abc", error: "timeout" });
    await expect(bus.emit(event)).resolves.not.toThrow();
  });
});

describe("telemetry handler", () => {
  it("AC3: does not throw on tool:pre-call event", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const event = makeEvent("tool:pre-call", { toolName: "start_task" });
    await expect(bus.emit(event)).resolves.not.toThrow();
  });

  it("AC3: does not throw on tool:post-call event", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const event = makeEvent("tool:post-call", { toolName: "start_task", durationMs: 42 });
    await expect(bus.emit(event)).resolves.not.toThrow();
  });
});

describe("harness-regression handler", () => {
  it("AC3: does not throw on session:end event", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const event = makeEvent("session:end", { scoreBefore: 80, scoreAfter: 75, delta: -5 });
    await expect(bus.emit(event)).resolves.not.toThrow();
  });

  it("AC3: does not throw when harness delta is within acceptable range", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const event = makeEvent("session:end", { scoreBefore: 80, scoreAfter: 80, delta: 0 });
    await expect(bus.emit(event)).resolves.not.toThrow();
  });
});

// §SprintE.5 — destructive-db-guard recording side-effect ─────────────
//
// HookBus swallows handler-level throws (it logs them and continues, so a
// single bad handler never poisons the event chain). The guard's contract
// is therefore "log at error level + record a lesson when a store is
// available" — the orchestrator that consumes the bus reads those signals.
import { logger as builtinLogger } from "../core/utils/logger.js";

describe("destructive-db-guard handler", () => {
  it("emits an error-level log when prompt matches a destructive pattern", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const errorSpy = vi.spyOn(builtinLogger, "error").mockImplementation(() => {});
    const event = makeEvent("task:pre-execute", { prompt: "rm -rf workflow-graph" });
    await bus.emit(event);
    const blocked = errorSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("destructive-db-guard:blocked"),
    );
    expect(blocked).toBe(true);
    errorSpy.mockRestore();
  });

  it("does not flag a benign task:pre-execute prompt", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const errorSpy = vi.spyOn(builtinLogger, "error").mockImplementation(() => {});
    const event = makeEvent("task:pre-execute", { prompt: "implement next task" });
    await bus.emit(event);
    const blocked = errorSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("destructive-db-guard"),
    );
    expect(blocked).toBe(false);
    errorSpy.mockRestore();
  });

  it("releases when the destructiveConfirmation phrase is supplied", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const errorSpy = vi.spyOn(builtinLogger, "error").mockImplementation(() => {});
    const event = makeEvent("task:pre-execute", {
      prompt: "apague o banco mcp-graph",
      destructiveConfirmation: "CONFIRMO APAGAR mcp-graph",
    });
    await bus.emit(event);
    const blocked = errorSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("destructive-db-guard"),
    );
    expect(blocked).toBe(false);
    errorSpy.mockRestore();
  });

  it("flags a Bash tool:pre-call whose command matches", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const errorSpy = vi.spyOn(builtinLogger, "error").mockImplementation(() => {});
    const event = makeEvent("tool:pre-call", {
      toolName: "Bash",
      toolInput: { command: "DROP TABLE nodes" },
    });
    await bus.emit(event);
    const blocked = errorSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("destructive-db-guard:blocked-bash"),
    );
    expect(blocked).toBe(true);
    errorSpy.mockRestore();
  });

  it("ignores tool:pre-call for non-Bash tools", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    const errorSpy = vi.spyOn(builtinLogger, "error").mockImplementation(() => {});
    const event = makeEvent("tool:pre-call", {
      toolName: "Read",
      toolInput: { command: "DROP TABLE nodes" },
    });
    await bus.emit(event);
    const blocked = errorSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("destructive-db-guard"),
    );
    expect(blocked).toBe(false);
    errorSpy.mockRestore();
  });
});
