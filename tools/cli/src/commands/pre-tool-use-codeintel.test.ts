/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * B3 — code-intelligence-driven block decisions in the pre-tool-use hook.
 * Verifies that severity:'error' code-intel warnings (e.g. index_empty under
 * strict mode) trigger the same exit-2 block path as lifecycle warnings, and
 * that severity:'warning' (advisory mode) only surfaces in detail.warnings_count
 * without blocking.
 */

import { describe, it, expect } from "vitest";
import { evaluatePreToolUse, type GateDeps } from "./pre-tool-use.js";

const fakeStore: object = { __test: true };

function makeDepsWithWarnings(
  warnings: ReadonlyArray<{ severity: "error" | "warning" | "info"; message: string; code?: string }>,
  phase = "IMPLEMENT",
): GateDeps {
  return {
    loadGateContext: () => ({ phase }),
    checkGates: () => ({
      allowed: !warnings.some((w) => w.severity === "error"),
      warnings,
      lifecycleBlock: { phase },
    }),
  };
}

describe("evaluatePreToolUse — code-intelligence block (B3)", () => {
  it("blocks (exit 2) when checkGates surfaces code-intel error (index_empty under strict)", () => {
    const deps = makeDepsWithWarnings([
      { severity: "error", message: "Code Intelligence index empty — run knowledge(action:reindex)", code: "index_empty" },
    ]);

    const outcome = evaluatePreToolUse(
      {
        tool_name: "mcp__mcp-graph__update_status",
        tool_input: { nodeId: "node_z", status: "done" },
      },
      { store: fakeStore, gateDeps: deps },
    );

    expect(outcome.exitCode).toBe(2);
    const stdoutJson = outcome.stdoutJson as { decision: string; reason: string };
    expect(stdoutJson.decision).toBe("block");
    expect(stdoutJson.reason).toContain("index empty");
  });

  it("does NOT block (exit 0) when only severity:'warning' code-intel warnings present (advisory mode)", () => {
    const deps = makeDepsWithWarnings([
      { severity: "warning", message: "Code Intelligence index is stale (git hash mismatch)", code: "index_stale" },
    ]);

    const outcome = evaluatePreToolUse(
      {
        tool_name: "mcp__mcp-graph__update_status",
        tool_input: { nodeId: "node_a", status: "done" },
      },
      { store: fakeStore, gateDeps: deps },
    );

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdoutJson).toBeUndefined();
    const detail = outcome.detail as { warnings_count: number; allowed: boolean };
    expect(detail.warnings_count).toBe(1);
    expect(detail.allowed).toBe(true);
  });

  it("joins lifecycle + code-intel error messages into single reason (semicolon-separated)", () => {
    const deps = makeDepsWithWarnings([
      { severity: "error", message: "Tool not allowed in ANALYZE phase", code: "tool_phase_blocked" },
      { severity: "error", message: "Code Intelligence index empty", code: "index_empty" },
      { severity: "warning", message: "stale index", code: "index_stale" },
    ], "ANALYZE");

    const outcome = evaluatePreToolUse(
      {
        tool_name: "mcp__mcp-graph__update_status",
        tool_input: { nodeId: "node_b", status: "done" },
      },
      { store: fakeStore, gateDeps: deps },
    );

    expect(outcome.exitCode).toBe(2);
    const stdoutJson = outcome.stdoutJson as { reason: string };
    expect(stdoutJson.reason).toContain("Tool not allowed");
    expect(stdoutJson.reason).toContain("Code Intelligence index empty");
    expect(stdoutJson.reason).toContain(";");
    // Warning-severity entries excluded
    expect(stdoutJson.reason).not.toContain("stale index");
  });

  it("surfaces lifecycleBlock.phase in stdoutJson.systemMessage when blocking on code-intel error", () => {
    const deps = makeDepsWithWarnings([
      { severity: "error", message: "Code Intelligence index empty", code: "index_empty" },
    ], "IMPLEMENT");

    const outcome = evaluatePreToolUse(
      {
        tool_name: "mcp__mcp-graph__update_status",
        tool_input: { nodeId: "node_c", status: "done" },
      },
      { store: fakeStore, gateDeps: deps },
    );

    expect(outcome.exitCode).toBe(2);
    const stdoutJson = outcome.stdoutJson as { systemMessage: string };
    expect(stdoutJson.systemMessage).toContain("phase=IMPLEMENT");
  });
});
