/**
 * MCP Handler routing tests for consolidated `knowledge` tool.
 * Tests action dispatch, invalid action handling, and schema validation.
 * Core logic is tested in dedicated unit tests — these test the MCP routing layer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

// ── Mocks for external dependencies ─────────────────────────────────────────

vi.mock("../core/rag/memory-indexer.js", () => ({
  indexMemories: vi.fn().mockResolvedValue({ documentsIndexed: 0, skipped: 0 }),
}));

vi.mock("../core/rag/docs-indexer.js", () => ({
  indexCachedDocs: vi.fn().mockReturnValue({ documentsIndexed: 0, skipped: 0 }),
}));

vi.mock("../core/rag/skill-indexer.js", () => ({
  indexSkills: vi.fn().mockResolvedValue({ documentsIndexed: 0, skipped: 0 }),
}));

vi.mock("../core/rag/journey-indexer.js", () => ({
  indexJourneyMaps: vi.fn().mockResolvedValue({ documentsIndexed: 0, skipped: 0 }),
}));

vi.mock("../core/rag/rag-pipeline.js", () => ({
  indexAllEmbeddings: vi.fn().mockResolvedValue({ indexed: 0 }),
  TfIdfVectorizer: class {
    fit(): void { /* noop */ }
    embed(): number[] { return [0]; }
    get vocabSize(): number { return 0; }
  },
}));

vi.mock("../core/rag/knowledge-quality.js", () => ({
  decayStaleKnowledge: vi.fn().mockReturnValue({ decayed: 0 }),
  recordUsage: vi.fn(),
}));

vi.mock("../core/rag/knowledge-linker.js", () => ({
  linkBySharedContext: vi.fn().mockReturnValue({ linked: 0 }),
}));

vi.mock("../core/rag/knowledge-synthesizer.js", () => ({
  runSynthesisCycle: vi.fn().mockReturnValue({ synthesized: 0 }),
}));

vi.mock("../core/rag/entity-indexer.js", () => ({
  reindexAll: vi.fn().mockReturnValue({ indexed: 0 }),
}));

vi.mock("../core/rag/node-indexer.js", () => ({
  indexAllNodes: vi.fn().mockReturnValue({ indexed: 0 }),
}));

vi.mock("../core/rag/code-context-indexer.js", () => ({
  indexCodeAnalysis: vi.fn().mockReturnValue({ indexed: 0 }),
}));

vi.mock("./context.js", () => ({
  invalidateRagCache: vi.fn(),
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

describe("MCP knowledge tool — action routing", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(async () => {
    store = SqliteStore.open(":memory:");
    store.initProject("test-project");
    server = createServer();
    const { registerKnowledge } = await import("../mcp/tools/knowledge.js");
    registerKnowledge(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should register the knowledge tool", () => {
    expect(tools(server).knowledge).toBeDefined();
  });

  it("should handle action: stats", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "stats" });
    const data = parseResult(result);
    expect(data).toHaveProperty("totalDocuments");
    expect(data.totalDocuments).toBe(0);
  });

  it("should handle action: reindex", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "reindex" });
    const data = parseResult(result);
    // Reindex returns summary of indexed docs
    expect(data).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it("should handle action: feedback", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "feedback", docId: "nonexistent", signal: "helpful" });
    const data = parseResult(result);
    // May return ok or error for nonexistent doc — routing still works
    expect(data).toBeDefined();
  });

  it("should handle action: prune with strategy and dry_run", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "prune", strategy: "budget", dryRun: true });
    const data = parseResult(result);
    expect(data).toBeDefined();
    expect(data).toHaveProperty("strategy", "budget");
    expect(result.isError).toBeUndefined();
  });

  it("should return error for prune without strategy", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "prune", dryRun: true });
    expect(result.isError).toBe(true);
  });

  it("should handle action: export with mode preview", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "export", exportMode: "preview" });
    const data = parseResult(result);
    expect(data).toBeDefined();
  });

  it("should return error for invalid action", async () => {
    const handler = tools(server).knowledge.handler;
    const result = await handler({ action: "invalid_action" });
    expect(result.isError).toBe(true);
  });
});
