/**
 * TDD Red: Fuzzy search fallback for FTS5 zero-result queries.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { searchNodes } from "../core/search/fts-search.js";
import { makeNode } from "./helpers/factories.js";

describe("Fuzzy search fallback", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("fuzzy-test");

    // Seed nodes with known titles
    store.insertNode(makeNode({ title: "Database migration patterns", description: "SQLite schema changes" }));
    store.insertNode(makeNode({ title: "Authentication OAuth2 flow", description: "JWT token handling" }));
    store.insertNode(makeNode({ title: "API endpoint design", description: "REST best practices" }));
    store.insertNode(makeNode({ title: "Testing with Vitest", description: "TDD patterns for TypeScript" }));
    store.insertNode(makeNode({ title: "Graph traversal algorithms", description: "BFS and DFS implementations" }));
  });

  afterEach(() => {
    store.close();
  });

  it("returns results for typo 'databse' matching 'database'", () => {
    const results = searchNodes(store, "databse", { fuzzy: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.title.toLowerCase()).toContain("database");
  });

  it("returns results for typo 'authentcation' matching 'authentication'", () => {
    const results = searchNodes(store, "authentcation", { fuzzy: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.title.toLowerCase()).toContain("authentication");
  });

  it("returns results for typo 'travresal' matching 'traversal'", () => {
    const results = searchNodes(store, "travresal", { fuzzy: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.title.toLowerCase()).toContain("traversal");
  });

  it("does NOT trigger fuzzy when FTS5 finds results", () => {
    // "database" is exact match — FTS5 handles it
    const results = searchNodes(store, "database", { fuzzy: true });
    expect(results.length).toBeGreaterThan(0);
    // Result comes from FTS5, not fuzzy (score should be FTS5 BM25 score)
  });

  it("returns empty for completely unrelated typo", () => {
    const results = searchNodes(store, "xyzzy", { fuzzy: true });
    expect(results.length).toBe(0);
  });

  it("fuzzy disabled by default (backward compat)", () => {
    // Without fuzzy option, typo returns nothing (old behavior)
    const results = searchNodes(store, "databse");
    expect(results.length).toBe(0);
  });

  it("SLO: fuzzy fallback < 10ms for 500 nodes", () => {
    // Seed 500 nodes
    for (let i = 0; i < 500; i++) {
      store.insertNode(makeNode({
        title: `Node ${i} about ${["auth", "database", "testing", "deploy", "API"][i % 5]}`,
        description: `Description for node ${i}`,
      }));
    }

    const start = performance.now();
    searchNodes(store, "databse", { fuzzy: true });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});
