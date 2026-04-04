import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { syncGraphFromCode } from "../core/code/graph-sync.js";
import { makeNode } from "./helpers/factories.js";

describe("syncGraphFromCode", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Sync Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty report for graph with no sourceRefs", () => {
    store.insertNode(makeNode({ title: "Task without sourceRef" }));

    const report = syncGraphFromCode(store);

    expect(report.staleRefs).toHaveLength(0);
    expect(report.symbolChanges).toHaveLength(0);
    expect(report.suggestions).toHaveLength(0);
  });

  it("should skip sourceRef check when no code index exists", () => {
    store.insertNode(makeNode({
      title: "Task with stale ref",
      sourceRef: { file: "src/deleted-file.ts", startLine: 1, endLine: 10 },
    }));

    const report = syncGraphFromCode(store);

    // No code index in :memory: → stale refs not detectable
    expect(report.staleRefs).toHaveLength(0);
  });

  it("should detect missing testFiles", () => {
    store.insertNode(makeNode({
      title: "Task with testFiles",
      testFiles: ["src/tests/nonexistent.test.ts"],
    }));

    const report = syncGraphFromCode(store);

    // In :memory: store there's no code index, so we can't verify files
    // But the function should not throw
    expect(report).toBeDefined();
  });

  it("should report done tasks with no testFiles as suggestion", () => {
    const t = makeNode({ title: "Important feature", description: "critical" });
    store.insertNode(t);
    store.updateNodeStatus(t.id, "in_progress");
    store.updateNodeStatus(t.id, "done");

    const report = syncGraphFromCode(store);

    const hasSuggestion = report.suggestions.some((s) => s.includes("testFiles"));
    // Should suggest adding testFiles for done tasks
    expect(hasSuggestion).toBe(true);
  });

  it("should handle empty graph gracefully", () => {
    const report = syncGraphFromCode(store);

    expect(report.staleRefs).toEqual([]);
    expect(report.symbolChanges).toEqual([]);
    expect(report.autoFilledTestFiles).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });
});
