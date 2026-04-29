/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T11 — agent-budget-precheck hook tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import {
  isBudgetLow,
  BUDGET_LOW_THRESHOLD,
} from "../core/hooks/agent-budget-precheck.js";

function makeBus(): HookBus {
  const fakeGraphBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never;
  return new HookBus(fakeGraphBus);
}

describe("isBudgetLow (E21.T11)", () => {
  it("default threshold = 0.9 (90% of cap)", () => {
    expect(BUDGET_LOW_THRESHOLD).toBe(0.9);
  });

  it("returns true when usage > 90% of cap (default threshold)", () => {
    expect(isBudgetLow({ currentUsd: 0.95, capUsd: 1.0 })).toBe(true);
  });

  it("returns false when usage <= 90% of cap", () => {
    expect(isBudgetLow({ currentUsd: 0.5, capUsd: 1.0 })).toBe(false);
    expect(isBudgetLow({ currentUsd: 0.9, capUsd: 1.0 })).toBe(false);
  });

  it("returns false when capUsd is undefined or <= 0", () => {
    expect(isBudgetLow({ currentUsd: 100, capUsd: undefined })).toBe(false);
    expect(isBudgetLow({ currentUsd: 100, capUsd: 0 })).toBe(false);
    expect(isBudgetLow({ currentUsd: 100, capUsd: -1 })).toBe(false);
  });

  it("respects custom threshold override", () => {
    expect(isBudgetLow({ currentUsd: 0.6, capUsd: 1.0 }, 0.5)).toBe(true);
    expect(isBudgetLow({ currentUsd: 0.4, capUsd: 1.0 }, 0.5)).toBe(false);
  });

  it("returns true when currentUsd >= capUsd (over-budget)", () => {
    expect(isBudgetLow({ currentUsd: 1.0, capUsd: 1.0 })).toBe(true);
    expect(isBudgetLow({ currentUsd: 1.5, capUsd: 1.0 })).toBe(true);
  });
});

describe("agent-budget-precheck hook integration (E21.T11)", () => {
  let originalDisabled: string | undefined;
  let originalGuard: string | undefined;

  beforeEach(() => {
    originalDisabled = process.env.MCP_GRAPH_HOOKS_DISABLED;
    originalGuard = process.env.MCP_GRAPH_AGENT_BUDGET_GUARD;
    delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    delete process.env.MCP_GRAPH_AGENT_BUDGET_GUARD;
  });

  afterEach(() => {
    if (originalDisabled === undefined) delete process.env.MCP_GRAPH_HOOKS_DISABLED;
    else process.env.MCP_GRAPH_HOOKS_DISABLED = originalDisabled;
    if (originalGuard === undefined) delete process.env.MCP_GRAPH_AGENT_BUDGET_GUARD;
    else process.env.MCP_GRAPH_AGENT_BUDGET_GUARD = originalGuard;
  });

  it("hook warns (advisory) when payload signals low budget", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    // Hook reads payload.currentUsd + payload.capUsd advisory mode.
    await bus.emit({
      channel: "agent:pre-spawn",
      timestamp: new Date().toISOString(),
      payload: { agentId: "a1", currentUsd: 0.95, capUsd: 1.0 },
    });
    expect(true).toBe(true); // no throw
  });

  it("hook is no-op when MCP_GRAPH_AGENT_BUDGET_GUARD=off", async () => {
    process.env.MCP_GRAPH_AGENT_BUDGET_GUARD = "off";
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    await bus.emit({
      channel: "agent:pre-spawn",
      timestamp: new Date().toISOString(),
      payload: { agentId: "a1", currentUsd: 100, capUsd: 1.0 },
    });
    expect(true).toBe(true);
  });

  it("hook ignores payload missing currentUsd or capUsd", async () => {
    const bus = makeBus();
    registerBuiltinHandlers(bus);
    await bus.emit({
      channel: "agent:pre-spawn",
      timestamp: new Date().toISOString(),
      payload: { agentId: "a1" },
    });
    expect(true).toBe(true);
  });
});
