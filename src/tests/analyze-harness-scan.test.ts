/**
 * TDD: harness_scan analyze mode
 *
 * Integration tests — run against the real project filesystem via process.cwd().
 * These tests confirm the analyze tool exposes harness_scan as a valid mode
 * and returns a well-formed HarnessabilityResult.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAnalyze } from "../mcp/tools/analyze.js";

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

describe("analyze(mode: 'harness_scan')", () => {
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

  it("should return ok:true with score and grade", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.score).toBe("number");
    expect(["A", "B", "C", "D"]).toContain(parsed.grade);
  });

  it("should return a breakdown with all 4 dimensions", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    const breakdown = parsed.breakdown as Record<string, unknown>;
    expect(breakdown).toBeDefined();
    expect(typeof (breakdown.types as Record<string, unknown>).score).toBe("number");
    expect(typeof (breakdown.tests as Record<string, unknown>).score).toBe("number");
    expect(typeof (breakdown.fitness as Record<string, unknown>).score).toBe("number");
    expect(typeof (breakdown.docs as Record<string, unknown>).score).toBe("number");
  });

  it("should return a timestamp", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("should include harness_scan in ANALYZE_MODES (no unknown mode error)", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_scan" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });
});
