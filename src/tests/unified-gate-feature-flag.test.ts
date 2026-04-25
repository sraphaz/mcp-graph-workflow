/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * TDD tests for the MCP_GRAPH_GATES_IN_HOOKS feature flag (Wave C2).
 *
 * When the flag is OFF (default), the unified-gate wrapper continues to run
 * the lifecycle/prereq/code-intel gate and may block a tool call. When the
 * flag is ON, the wrapper short-circuits that gate and lets the call through
 * — the PreToolUse hook is then the sole pre-execution enforcement layer.
 *
 * The deprecation gate (DEPRECATED_TOOLS) is independent of this flag and
 * runs in both modes — that's how `removed` tools stay blocked even when the
 * lifecycle gate is delegated to the hook.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  DEPRECATED_TOOLS,
  wrapToolsWithGates,
} from "../mcp/unified-gate.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServer = any;

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function createServer(): McpServer {
  return new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

function tools(server: McpServer): Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> {
  return (server as AnyServer)._registeredTools;
}

function setEnv(key: string, value: string | undefined): string | undefined {
  const prev = process.env[key];
  if (value === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  return prev;
}

describe("unified-gate — MCP_GRAPH_GATES_IN_HOOKS feature flag (Wave C2)", () => {
  let store: SqliteStore;
  let server: McpServer;
  let prevFlag: string | undefined;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    prevFlag = setEnv("MCP_GRAPH_GATES_IN_HOOKS", undefined);
  });

  afterEach(() => {
    setEnv("MCP_GRAPH_GATES_IN_HOOKS", prevFlag);
    delete DEPRECATED_TOOLS["__c2_test_removed_tool__"];
    store.close();
  });

  it("AC1 — default (flag unset): wrapper STILL gates a mutating tool in strict ANALYZE phase", async () => {
    // Force ANALYZE phase + strict mode → update_status should be blocked.
    store.setProjectSetting("lifecycle_phase_override", "ANALYZE");
    store.setProjectSetting("lifecycle_strictness_mode", "strict");

    server.tool(
      "update_status",
      "Update status",
      { id: z.union([z.string(), z.array(z.string())]).optional(), status: z.string().optional() },
      async () => ({ content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] }),
    );

    wrapToolsWithGates(server, store);

    const result = (await tools(server)["update_status"].handler({ id: "node_x", status: "done" })) as ToolCallResult;
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error).toBe("lifecycle_gate_blocked");
  });

  it("AC2 — MCP_GRAPH_GATES_IN_HOOKS=on: wrapper SHORT-CIRCUITS the lifecycle gate; tool runs normally", async () => {
    setEnv("MCP_GRAPH_GATES_IN_HOOKS", "on");

    store.setProjectSetting("lifecycle_phase_override", "ANALYZE");
    store.setProjectSetting("lifecycle_strictness_mode", "strict");

    let executed = false;
    server.tool(
      "update_status",
      "Update status",
      { id: z.union([z.string(), z.array(z.string())]).optional(), status: z.string().optional() },
      async () => {
        executed = true;
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] };
      },
    );

    wrapToolsWithGates(server, store);

    const result = (await tools(server)["update_status"].handler({ id: "node_x", status: "done" })) as ToolCallResult;
    expect(executed).toBe(true);
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);
  });

  it("AC3 — MCP_GRAPH_GATES_IN_HOOKS=on does NOT disable the deprecation gate", async () => {
    setEnv("MCP_GRAPH_GATES_IN_HOOKS", "on");

    DEPRECATED_TOOLS["__c2_test_removed_tool__"] = {
      stage: "removed",
      replacement: "new_tool",
    };

    let executed = false;
    server.tool("__c2_test_removed_tool__", "Removed tool", {}, async () => {
      executed = true;
      return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] };
    });

    wrapToolsWithGates(server, store);

    const result = (await tools(server)["__c2_test_removed_tool__"].handler({})) as ToolCallResult;
    // Deprecation gate runs regardless of MCP_GRAPH_GATES_IN_HOOKS — `removed`
    // tools must still be blocked.
    expect(executed).toBe(false);
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error).toBe("tool_removed");
  });

  it("flag values other than 'on' do NOT disable the gate (only literal 'on' counts)", async () => {
    for (const value of ["true", "1", "yes", "ON", "off"]) {
      setEnv("MCP_GRAPH_GATES_IN_HOOKS", value);

      const localStore = SqliteStore.open(":memory:");
      localStore.initProject("Test");
      localStore.setProjectSetting("lifecycle_phase_override", "ANALYZE");
      localStore.setProjectSetting("lifecycle_strictness_mode", "strict");

      const localServer = createServer();
      localServer.tool(
        "update_status",
        "Update status",
        { id: z.union([z.string(), z.array(z.string())]).optional(), status: z.string().optional() },
        async () => ({ content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] }),
      );

      wrapToolsWithGates(localServer, localStore);

      const result = (await tools(localServer)["update_status"].handler({ id: "node_x", status: "done" })) as ToolCallResult;
      expect(result.isError, `flag value '${value}' should still gate`).toBe(true);

      localStore.close();
    }
  });
});
