/**
 * TDD: harness_advice analyze mode
 *
 * Tests for the remediation advice mode that returns
 * per-dimension file-level improvement suggestions.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { registerAnalyze } from "../../mcp/tools/analyze.js";

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

describe("analyze(mode: 'harness_advice')", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerAnalyze(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should return ok:true with advice array", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_advice" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe("harness_advice");
    expect(Array.isArray(parsed.advice)).toBe(true);
  });

  it("should include score and grade in response", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_advice" });
    const parsed = parseResult(result);
    expect(typeof parsed.score).toBe("number");
    expect(["A", "B", "C", "D"]).toContain(parsed.grade);
  });

  it("should include harness_advice in ANALYZE_MODES (no unknown mode error)", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_advice" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  it("should limit advice items to max 10 per dimension", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_advice" });
    const parsed = parseResult(result);
    const advice = parsed.advice as Array<{ dimension: string; files: unknown[] }>;
    for (const entry of advice) {
      expect(entry.files.length).toBeLessThanOrEqual(10);
    }
  });
});
