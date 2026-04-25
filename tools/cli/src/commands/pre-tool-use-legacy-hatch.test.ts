/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * C3 — verifies the MCP_GRAPH_LEGACY_HOOKS escape hatch.
 *
 * When MCP_GRAPH_LEGACY_HOOKS=on, evaluatePreToolUse short-circuits BEFORE
 * input filtering or gate evaluation — the hook becomes a no-op so users can
 * unblock their session if a hook regression slips into production. This
 * mirrors MCP_GRAPH_LEGACY_TOOLS=on (which downgrades `removed`-stage tools
 * back to advisory) — both flags are session-scoped escape hatches.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evaluatePreToolUse, type GateDeps } from "./pre-tool-use.js";

const fakeStore: object = { __test: true };

const blockingDeps: GateDeps = {
  loadGateContext: () => ({ phase: "IMPLEMENT" }),
  // Always returns a block decision so we can detect short-circuit
  checkGates: () => ({
    allowed: false,
    warnings: [{ severity: "error", message: "would block", code: "test_block" }],
    lifecycleBlock: { phase: "IMPLEMENT" },
  }),
};

describe("MCP_GRAPH_LEGACY_HOOKS escape hatch (C3)", () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.MCP_GRAPH_LEGACY_HOOKS;
    delete process.env.MCP_GRAPH_LEGACY_HOOKS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.MCP_GRAPH_LEGACY_HOOKS;
    else process.env.MCP_GRAPH_LEGACY_HOOKS = original;
  });

  it("AC1 — flag=on short-circuits BEFORE gate evaluation (exit 0, filtered:legacy_hooks_off)", () => {
    process.env.MCP_GRAPH_LEGACY_HOOKS = "on";

    const outcome = evaluatePreToolUse(
      {
        tool_name: "mcp__mcp-graph__update_status",
        tool_input: { nodeId: "n", status: "done" },
      },
      { store: fakeStore, gateDeps: blockingDeps },
    );

    expect(outcome.exitCode).toBe(0);
    expect(outcome.detail).toMatchObject({ filtered: "legacy_hooks_off" });
    expect(outcome.stdoutJson).toBeUndefined();
  });

  it("AC2 — flag unset: normal gate evaluation runs (would block in this scenario)", () => {
    const outcome = evaluatePreToolUse(
      {
        tool_name: "mcp__mcp-graph__update_status",
        tool_input: { nodeId: "n", status: "done" },
      },
      { store: fakeStore, gateDeps: blockingDeps },
    );

    expect(outcome.exitCode).toBe(2);
    expect(outcome.detail).toMatchObject({ decision: "block" });
  });

  it("AC3 — symmetry with MCP_GRAPH_LEGACY_TOOLS: only literal 'on' counts (other truthy values do NOT bypass)", () => {
    for (const variant of ["1", "true", "yes", "ON", "On", "off", ""]) {
      process.env.MCP_GRAPH_LEGACY_HOOKS = variant;

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "n", status: "done" },
        },
        { store: fakeStore, gateDeps: blockingDeps },
      );

      // Anything other than literal "on" → gate ran → block decision returned
      expect(outcome.exitCode, `value=${JSON.stringify(variant)}`).toBe(2);
    }
  });

  it("flag=on also short-circuits even when no gateDeps provided (skeleton fallback)", () => {
    process.env.MCP_GRAPH_LEGACY_HOOKS = "on";

    const outcome = evaluatePreToolUse({
      tool_name: "mcp__mcp-graph__update_status",
      tool_input: { nodeId: "n", status: "done" },
    });

    // Even without deps, the legacy_hooks_off branch wins — escape hatch
    // is the very first early-exit, before filter/skeleton fallthrough.
    expect(outcome.exitCode).toBe(0);
    expect(outcome.detail).toMatchObject({ filtered: "legacy_hooks_off" });
  });

  it("flag=on short-circuits non-mcp tools too (uniform no-op for the entire hook)", () => {
    process.env.MCP_GRAPH_LEGACY_HOOKS = "on";

    const outcome = evaluatePreToolUse(
      {
        tool_name: "Edit",
        tool_input: { file: "/tmp/x" },
      },
      { store: fakeStore, gateDeps: blockingDeps },
    );

    expect(outcome.exitCode).toBe(0);
    expect(outcome.detail).toMatchObject({ filtered: "legacy_hooks_off" });
  });
});
