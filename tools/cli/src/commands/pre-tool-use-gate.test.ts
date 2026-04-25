/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { evaluatePreToolUse, type GateDeps } from "./pre-tool-use.js";

/**
 * B2 — gate evaluation tests. The pre-tool-use core is dependency-injected:
 * pass a `store` (opaque) plus a `gateDeps` object containing
 * `loadGateContext` and `checkGates`. The hook-dispatch wires production
 * deps via `lazy-gate.ts` (mirrors `lazy-store.ts`). Tests inject stubs.
 */

const fakeStore: object = { __test: true };

function makeGateDeps(overrides: Partial<GateDeps> = {}): GateDeps {
  return {
    loadGateContext: () => ({
      phase: "IMPLEMENT",
      lifecycleMode: "strict",
      codeIntelMode: "off",
      doc: { nodes: [], edges: [] },
      phaseOverride: null,
      hasSnapshots: false,
    }),
    checkGates: () => ({
      allowed: true,
      warnings: [],
      lifecycleBlock: { phase: "IMPLEMENT" },
    }),
    ...overrides,
  };
}

describe("evaluatePreToolUse — gate evaluation (B2)", () => {
  describe("strict mode block", () => {
    it("returns exit 2 + stdout JSON {decision:block} when checkGates returns allowed=false", () => {
      const deps = makeGateDeps({
        checkGates: () => ({
          allowed: false,
          warnings: [
            { severity: "error", message: "Missing prerequisite: analyze(implement_done)", code: "prereq_missing" },
          ],
          lifecycleBlock: { phase: "IMPLEMENT" },
        }),
      });

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_xyz", status: "done" },
        },
        { store: fakeStore, gateDeps: deps },
      );

      expect(outcome.exitCode).toBe(2);
      expect(outcome.stdoutJson).toMatchObject({
        decision: "block",
        reason: expect.stringContaining("Missing prerequisite"),
      });
      expect(outcome.detail).toMatchObject({ decision: "block" });
    });

    it("joins multiple error-severity warnings into a single reason string", () => {
      const deps = makeGateDeps({
        checkGates: () => ({
          allowed: false,
          warnings: [
            { severity: "error", message: "Tool not recommended for ANALYZE phase", code: "tool_phase_blocked" },
            { severity: "error", message: "Missing prerequisite: context", code: "prereq_missing" },
            { severity: "warning", message: "stale index", code: "index_stale" },
          ],
          lifecycleBlock: { phase: "ANALYZE" },
        }),
      });

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_x", status: "done" },
        },
        { store: fakeStore, gateDeps: deps },
      );

      expect(outcome.exitCode).toBe(2);
      const stdoutJson = outcome.stdoutJson as { reason: string };
      expect(stdoutJson.reason).toContain("Tool not recommended");
      expect(stdoutJson.reason).toContain("Missing prerequisite: context");
      // Warning-severity entries should NOT be in the reason
      expect(stdoutJson.reason).not.toContain("stale index");
    });
  });

  describe("advisory mode (no error-severity warnings)", () => {
    it("returns exit 0 when checkGates returns allowed=true", () => {
      const deps = makeGateDeps();

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_y", status: "in_progress" },
        },
        { store: fakeStore, gateDeps: deps },
      );

      expect(outcome.exitCode).toBe(0);
      expect(outcome.stdoutJson).toBeUndefined();
      expect(outcome.detail).toMatchObject({ allowed: true });
    });

    it("returns exit 0 with systemMessage hint when warnings exist but none are error-severity", () => {
      const deps = makeGateDeps({
        checkGates: () => ({
          allowed: true,
          warnings: [
            { severity: "warning", message: "Tool not in phase recommended set", code: "tool_phase_advisory" },
          ],
          lifecycleBlock: { phase: "IMPLEMENT" },
        }),
      });

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_z", status: "done" },
        },
        { store: fakeStore, gateDeps: deps },
      );

      expect(outcome.exitCode).toBe(0);
      // Advisory: no block, but surface the warning so the model can see it
      const detail = outcome.detail as { allowed: boolean; warnings_count: number };
      expect(detail.allowed).toBe(true);
      expect(detail.warnings_count).toBe(1);
    });
  });

  describe("fail-open behaviour", () => {
    it("returns exit 0 when gateDeps is missing (skeleton fallthrough)", () => {
      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_a", status: "done" },
        },
        // No gateDeps / no store
      );

      expect(outcome.exitCode).toBe(0);
      expect(outcome.detail).toMatchObject({ skeleton: "gate_eval_pending" });
    });

    it("returns exit 0 when checkGates throws (fail-open)", () => {
      const deps = makeGateDeps({
        checkGates: () => {
          throw new Error("simulated SqliteStore lock contention");
        },
      });

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_b", status: "done" },
        },
        { store: fakeStore, gateDeps: deps },
      );

      expect(outcome.exitCode).toBe(0);
      expect(outcome.detail).toMatchObject({ filtered: "gate_error" });
    });
  });

  describe("read-only tools still bypass gates even when deps are provided", () => {
    it("returns exit 0 + filtered:read_only without invoking checkGates", () => {
      let called = false;
      const deps = makeGateDeps({
        checkGates: () => {
          called = true;
          return { allowed: false, warnings: [], lifecycleBlock: { phase: "IMPLEMENT" } };
        },
      });

      const outcome = evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__list",
          tool_input: {},
        },
        { store: fakeStore, gateDeps: deps },
      );

      expect(outcome.exitCode).toBe(0);
      expect(outcome.detail).toMatchObject({ filtered: "read_only" });
      expect(called).toBe(false);
    });
  });
});
