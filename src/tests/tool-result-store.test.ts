import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ToolResultStore } from "../core/store/tool-result-store.js";
import { runMigrations } from "../core/store/migrations.js";

describe("ToolResultStore", () => {
  let db: Database.Database;
  let store: ToolResultStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new ToolResultStore(db);
  });

  it("should record and retrieve a tool result", () => {
    store.record("proj_1", "trace_1", "search", { query: "auth" }, { results: [1, 2, 3] });

    const results = store.getByTrace("trace_1");
    expect(results).toHaveLength(1);
    expect(results[0].toolName).toBe("search");
    expect(results[0].traceId).toBe("trace_1");
    expect(JSON.parse(results[0].result)).toEqual({ results: [1, 2, 3] });
  });

  it("should dedup identical results by hash", () => {
    const result = { data: "same content" };
    store.record("proj_1", "trace_1", "search", {}, result);
    store.record("proj_1", "trace_2", "search", {}, result);

    // Both should be stored (different traces), but same hash
    const r1 = store.getByTrace("trace_1");
    const r2 = store.getByTrace("trace_2");
    expect(r1[0].resultHash).toBe(r2[0].resultHash);
  });

  it("should truncate results larger than 100KB", () => {
    const largeResult = { data: "x".repeat(200_000) };
    store.record("proj_1", "trace_1", "big_tool", {}, largeResult);

    const results = store.getByTrace("trace_1");
    expect(results[0].truncated).toBe(true);
    // sizeBytes stores original size; result text is truncated to 100KB
    expect(results[0].result.length).toBeLessThanOrEqual(102_400 + 100);
    expect(results[0].sizeBytes).toBeGreaterThan(102_400); // original was bigger
  });

  it("should retrieve by tool name", () => {
    store.record("proj_1", "trace_1", "search", {}, { a: 1 });
    store.record("proj_1", "trace_2", "analyze", {}, { b: 2 });
    store.record("proj_1", "trace_3", "search", {}, { c: 3 });

    const searchResults = store.getByToolName("proj_1", "search");
    expect(searchResults).toHaveLength(2);
    expect(searchResults.every((r) => r.toolName === "search")).toBe(true);
  });

  it("should store and return correct metadata", () => {
    store.record("proj_1", "trace_1", "context", { focus: "auth" }, { text: "data" });

    const results = store.getByTrace("trace_1");
    expect(results[0].projectId).toBe("proj_1");
    expect(results[0].toolArgs).toContain("auth");
    expect(results[0].createdAt).toBeTruthy();
  });

  it("should handle empty result", () => {
    store.record("proj_1", "trace_1", "empty_tool", {}, {});

    const results = store.getByTrace("trace_1");
    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].result)).toEqual({});
  });
});
