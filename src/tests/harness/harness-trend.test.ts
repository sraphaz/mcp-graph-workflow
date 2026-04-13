/**
 * TDD: harness_trend analyze mode
 *
 * Tests for the harness_trend mode that reads harness_history
 * and returns score evolution with trend direction.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { registerAnalyze } from "../../mcp/tools/analyze.js";
import { generateId } from "../../core/utils/id.js";

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

function insertHistory(
  store: SqliteStore,
  entries: Array<{ score: number; grade: string; timestamp: string }>,
): void {
  const db = store.getDb();
  const project = store.getActiveProject();
  const projectId = project?.id ?? "test";
  for (const entry of entries) {
    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run(
      generateId("hh"),
      projectId,
      entry.score,
      entry.grade,
      JSON.stringify({ types: { score: entry.score, weight: 0.3 } }),
      entry.timestamp,
    );
  }
}

describe("analyze(mode: 'harness_trend')", () => {
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

  it("should return no_data when no history exists", async () => {
    const result = await tools(server)["analyze"].handler({ mode: "harness_trend" });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.trend).toBe("no_data");
    expect(parsed.history).toEqual([]);
  });

  it("should return history entries ordered by timestamp ASC", async () => {
    insertHistory(store, [
      { score: 60, grade: "C", timestamp: "2026-04-10T10:00:00Z" },
      { score: 65, grade: "C", timestamp: "2026-04-11T10:00:00Z" },
      { score: 70, grade: "B", timestamp: "2026-04-12T10:00:00Z" },
      { score: 75, grade: "B", timestamp: "2026-04-13T10:00:00Z" },
      { score: 80, grade: "B", timestamp: "2026-04-14T10:00:00Z" },
    ]);

    const result = await tools(server)["analyze"].handler({ mode: "harness_trend" });
    const parsed = parseResult(result);
    const history = parsed.history as Array<{ score: number; timestamp: string }>;

    expect(history).toHaveLength(5);
    expect(history[0].score).toBe(60);
    expect(history[4].score).toBe(80);
  });

  it("should detect improving trend when scores increase", async () => {
    insertHistory(store, [
      { score: 60, grade: "C", timestamp: "2026-04-10T10:00:00Z" },
      { score: 70, grade: "B", timestamp: "2026-04-11T10:00:00Z" },
      { score: 80, grade: "B", timestamp: "2026-04-12T10:00:00Z" },
    ]);

    const result = await tools(server)["analyze"].handler({ mode: "harness_trend" });
    const parsed = parseResult(result);
    expect(parsed.trend).toBe("improving");
    expect(parsed.delta).toBe(20);
  });

  it("should detect degrading trend when scores decrease", async () => {
    insertHistory(store, [
      { score: 80, grade: "B", timestamp: "2026-04-10T10:00:00Z" },
      { score: 70, grade: "B", timestamp: "2026-04-11T10:00:00Z" },
      { score: 60, grade: "C", timestamp: "2026-04-12T10:00:00Z" },
    ]);

    const result = await tools(server)["analyze"].handler({ mode: "harness_trend" });
    const parsed = parseResult(result);
    expect(parsed.trend).toBe("degrading");
    expect(parsed.delta).toBe(-20);
  });

  it("should detect stable trend when variation < 2 points", async () => {
    insertHistory(store, [
      { score: 70, grade: "B", timestamp: "2026-04-10T10:00:00Z" },
      { score: 71, grade: "B", timestamp: "2026-04-11T10:00:00Z" },
      { score: 70, grade: "B", timestamp: "2026-04-12T10:00:00Z" },
    ]);

    const result = await tools(server)["analyze"].handler({ mode: "harness_trend" });
    const parsed = parseResult(result);
    expect(parsed.trend).toBe("stable");
  });

  it("should limit history to last 10 entries", async () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      score: 50 + i,
      grade: i >= 5 ? "C" : "D",
      timestamp: `2026-04-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    insertHistory(store, entries);

    const result = await tools(server)["analyze"].handler({ mode: "harness_trend" });
    const parsed = parseResult(result);
    const history = parsed.history as Array<{ score: number }>;

    expect(history).toHaveLength(10);
  });
});
