/**
 * MCP Handler routing tests for consolidated `context` tool.
 * Tests action dispatch for compact, rag, compress, batch_compress.
 * Core logic is tested in dedicated unit tests — these test the MCP routing layer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../core/rag/rag-pipeline.js", () => ({
  indexAllEmbeddings: vi.fn().mockResolvedValue({ indexed: 0 }),
  TfIdfVectorizer: class {
    fit(): void { /* noop */ }
    embed(): number[] { return [0]; }
    get vocabSize(): number { return 0; }
  },
}));

vi.mock("../core/rag/knowledge-quality.js", () => ({
  recordUsage: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = any;

function createServer(): McpServer {
  return new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
}

function tools(server: McpServer): AnyTools {
  return (server as AnyTools)._registeredTools;
}

function parseResult(result: { content: { type: string; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe("MCP context tool — action routing", () => {
  let store: SqliteStore;
  let server: McpServer;
  let nodeId: string;

  beforeEach(async () => {
    store = SqliteStore.open(":memory:");
    store.initProject("test-project");
    const node = makeNode({ title: "Test task", type: "task", status: "in_progress" });
    store.insertNode(node);
    nodeId = node.id;
    server = createServer();
    const { registerContext } = await import("../mcp/tools/context.js");
    registerContext(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should register the context tool", () => {
    expect(tools(server).context).toBeDefined();
  });

  it("should handle action: compact with valid nodeId", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({ action: "compact", id: nodeId });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    // Compact returns task context with task.id matching nodeId
    expect(data).toHaveProperty("task");
  });

  it("should handle action: compact with invalid nodeId", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({ action: "compact", id: "nonexistent" });
    expect(result.isError).toBe(true);
  });

  it("should handle action: compress with text and format", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({
      action: "compress",
      text: "This is a sample text for compression testing. It includes multiple sentences to ensure the compressor has content to work with.",
      format: "bullets",
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data).toHaveProperty("compressed");
  });

  it("should return error for compress without format", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({ action: "compress", text: "Some text" });
    expect(result.isError).toBe(true);
  });

  it("should handle action: batch_compress with array of texts", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({
      action: "batch_compress",
      texts: [
        { text: "Text one for batch compression.", format: "bullets" },
        { text: "Text two for batch compression.", format: "bullets" },
      ],
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);
  });

  it("should handle action: rag with query", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({ action: "rag", query: "test query", budget: 1000 });
    const data = parseResult(result);
    // RAG returns context even if empty knowledge store
    expect(data).toBeDefined();
  });

  it("should return error for invalid action", async () => {
    const handler = tools(server).context.handler;
    const result = await handler({ action: "invalid_action" });
    expect(result.isError).toBe(true);
  });
});
