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
 * TDD tests for graph_refresh_docs (Task 4.6).
 *
 * graph_refresh_docs is a name alias for sync_stack_docs in the graph_*
 * naming family. Behaviour MUST be identical — both tools route to the
 * same shared handler in sync-stack-docs.ts.
 *
 * Validates ACs:
 * - GIVEN graph_refresh_docs WHEN called THEN behavior identical to sync_stack_docs
 * - GIVEN sync_stack_docs legacy WHEN called THEN still works
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerSyncStackDocs } from "../mcp/tools/sync-stack-docs.js";
import { registerGraphRefreshDocs } from "../mcp/tools/graph-refresh-docs.js";

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

function tools(server: McpServer): Record<string, { handler: (args: unknown) => Promise<unknown> }> {
  return (server as AnyServer)._registeredTools;
}

describe("graph_refresh_docs / sync_stack_docs", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerSyncStackDocs(server, store);
    registerGraphRefreshDocs(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("registers both sync_stack_docs and graph_refresh_docs", () => {
    expect(tools(server)["sync_stack_docs"]).toBeDefined();
    expect(tools(server)["graph_refresh_docs"]).toBeDefined();
  });

  it("AC1 — graph_refresh_docs and sync_stack_docs produce identical responses (no libraries to sync)", async () => {
    // Empty libraries list and a non-detected stack — both should emit the
    // "No libraries detected to sync" path with byte-identical payloads.
    const args = { basePath: "/tmp/__nonexistent_path_for_test__", libraries: [] };

    const a = (await tools(server)["sync_stack_docs"].handler(args)) as ToolCallResult;
    const b = (await tools(server)["graph_refresh_docs"].handler(args)) as ToolCallResult;

    expect(a.content[0].text).toBe(b.content[0].text);
  });

  it("AC1 — graph_refresh_docs response shape matches sync_stack_docs contract", async () => {
    const result = (await tools(server)["graph_refresh_docs"].handler({
      basePath: "/tmp/__nonexistent_path_for_test__",
      libraries: [],
    })) as ToolCallResult;
    const payload = JSON.parse(result.content[0].text);
    // Same fields as sync_stack_docs: ok + (message OR librariesProcessed/results/knowledgeIndexed)
    expect(payload).toHaveProperty("ok");
  });

  it("AC2 — sync_stack_docs legacy continues to work after the alias is registered", async () => {
    const result = (await tools(server)["sync_stack_docs"].handler({
      basePath: "/tmp/__nonexistent_path_for_test__",
      libraries: [],
    })) as ToolCallResult;
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toHaveProperty("ok");
  });

  it("graph_refresh_docs accepts the same input schema (basePath optional, libraries optional)", async () => {
    // No args at all — should not throw
    const result = (await tools(server)["graph_refresh_docs"].handler({})) as ToolCallResult;
    expect(result).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });
});
