/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 7.6 #7.6.8 — verify the `node` MCP tool auto-fills
 * metadata.provenance when callers don't supply it, and respects
 * caller-provided provenance otherwise.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerNode } from "../mcp/tools/node.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServer = any;

interface ToolHandler {
  handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}

function callNodeTool(server: McpServer, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const tool = ((server as AnyServer)._registeredTools as Record<string, ToolHandler>)["node"];
  return tool.handler(args, {});
}

describe("node MCP tool — provenance auto-fill (Sprint 7.6 #7.6.8)", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
    registerNode(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("auto-fills metadata.provenance when caller omits metadata", async () => {
    const result = await callNodeTool(server, {
      action: "add",
      type: "task",
      title: "Test task",
    });
    expect(result.isError).not.toBe(true);
    const text = result.content[0]?.text ?? "";
    const created = JSON.parse(text) as { ok: true; node: { id: string } };
    const node = store.getNodeById(created.node.id);
    expect(node?.metadata).toBeDefined();
    const provenance = (node?.metadata as Record<string, unknown>)?.provenance as Record<string, unknown>;
    expect(provenance).toBeDefined();
    expect(provenance.source).toBe("mcp");
    expect(typeof provenance.actor).toBe("string");
    expect(typeof provenance.ts).toBe("string");
  });

  it("preserves caller-supplied provenance untouched", async () => {
    const callerProvenance = { source: "graph-importer", actor: "test-agent", ts: "2026-01-01T00:00:00Z" };
    const result = await callNodeTool(server, {
      action: "add",
      type: "task",
      title: "Imported task",
      metadata: { provenance: callerProvenance, importedFrom: "PRD-v11.md" },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content[0]?.text ?? "";
    const created = JSON.parse(text) as { ok: true; node: { id: string } };
    const node = store.getNodeById(created.node.id);
    const meta = node?.metadata as Record<string, unknown>;
    expect(meta.provenance).toEqual(callerProvenance);
    expect(meta.importedFrom).toBe("PRD-v11.md");
  });

  it("merges with existing metadata when adding provenance", async () => {
    const result = await callNodeTool(server, {
      action: "add",
      type: "task",
      title: "Test merge",
      metadata: { customKey: "custom-value" },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content[0]?.text ?? "";
    const created = JSON.parse(text) as { ok: true; node: { id: string } };
    const node = store.getNodeById(created.node.id);
    const meta = node?.metadata as Record<string, unknown>;
    expect(meta.customKey).toBe("custom-value");
    expect((meta.provenance as Record<string, unknown>)?.source).toBe("mcp");
  });

  it("auto-fills provenance on each entry in batch_add", async () => {
    const result = await callNodeTool(server, {
      action: "batch_add",
      nodes: [
        { type: "task", title: "Batch entry 1" },
        { type: "task", title: "Batch entry 2", metadata: { customKey: "x" } },
      ],
    });
    expect(result.isError).not.toBe(true);
    const list = store.getNodesByStatus("backlog");
    const a = list.find((n: { title: string }) => n.title === "Batch entry 1");
    const b = list.find((n: { title: string }) => n.title === "Batch entry 2");
    expect((a?.metadata as Record<string, unknown>)?.provenance).toBeDefined();
    expect((b?.metadata as Record<string, unknown>)?.provenance).toBeDefined();
    expect((b?.metadata as Record<string, unknown>)?.customKey).toBe("x");
  });
});
