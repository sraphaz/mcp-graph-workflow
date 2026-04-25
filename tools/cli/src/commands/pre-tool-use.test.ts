/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { evaluatePreToolUse, type PreToolUseInput } from "./pre-tool-use.js";

describe("evaluatePreToolUse — skeleton (B1)", () => {
  describe("input filtering (early-exit)", () => {
    it("returns exit 0 + filtered:no_input when input is null", () => {
      const outcome = evaluatePreToolUse(null);
      expect(outcome.exitCode).toBe(0);
      expect(outcome.detail).toMatchObject({ filtered: "no_input" });
    });

    it("returns exit 0 + filtered:non_mcp for non-MCP tool names", () => {
      const cases: PreToolUseInput[] = [
        { tool_name: "Edit", tool_input: { file: "x" } },
        { tool_name: "Bash", tool_input: { command: "ls" } },
        { tool_name: "Write", tool_input: {} },
        { tool_name: "mcp__playwright__browser_click", tool_input: {} },
      ];
      for (const input of cases) {
        const outcome = evaluatePreToolUse(input);
        expect(outcome.exitCode).toBe(0);
        expect(outcome.detail).toMatchObject({ filtered: "non_mcp" });
      }
    });

    it("returns exit 0 + filtered:read_only for read-only mcp-graph tools", () => {
      const readOnlyTools = [
        "list", "show", "search", "metrics", "export", "context",
        "knowledge", "analyze", "snapshot", "next",
        "read_memory", "list_memories", "manage_skill",
        "validate", "code_intelligence", "journey",
        "init", "set_phase", "sync_stack_docs",
      ];
      for (const bare of readOnlyTools) {
        const outcome = evaluatePreToolUse({
          tool_name: `mcp__mcp-graph__${bare}`,
          tool_input: {},
        });
        expect(outcome.exitCode).toBe(0);
        expect(outcome.detail).toMatchObject({ filtered: "read_only", tool: bare });
      }
    });

    it("returns exit 0 + skeleton marker for mutating mcp-graph tools (gate eval comes in B2)", () => {
      const mutatingTools = ["update_status", "node", "edge", "start_task", "finish_task"];
      for (const bare of mutatingTools) {
        const outcome = evaluatePreToolUse({
          tool_name: `mcp__mcp-graph__${bare}`,
          tool_input: { nodeId: "node_xyz" },
        });
        expect(outcome.exitCode).toBe(0);
        // B1 skeleton: still exit 0 because gate evaluation isn't wired yet.
        // B2 will add gate logic that may set exitCode=2 + stdoutJson with block decision.
        expect(outcome.detail).toMatchObject({ skeleton: "gate_eval_pending", tool: bare });
      }
    });
  });

  describe("escape hatch", () => {
    it("MCP_GRAPH_LEGACY_HOOKS=on short-circuits even mutating tools", () => {
      const original = process.env.MCP_GRAPH_LEGACY_HOOKS;
      try {
        process.env.MCP_GRAPH_LEGACY_HOOKS = "on";
        const outcome = evaluatePreToolUse({
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: "node_xyz", status: "done" },
        });
        expect(outcome.exitCode).toBe(0);
        expect(outcome.detail).toMatchObject({ filtered: "legacy_hooks_off" });
      } finally {
        if (original === undefined) {
          delete process.env.MCP_GRAPH_LEGACY_HOOKS;
        } else {
          process.env.MCP_GRAPH_LEGACY_HOOKS = original;
        }
      }
    });
  });
});
