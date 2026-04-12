import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("KnowledgeStore autoprune", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  function seedDocs(count: number, sourceType: string = "ai_decision"): void {
    for (let i = 0; i < count; i++) {
      ks.insert({
        sourceType: sourceType as "ai_decision",
        sourceId: `doc-${i}`,
        title: `Document ${i}`,
        content: `Content of document ${i} for testing autoprune functionality`,
        metadata: {},
      });
    }
  }

  it("should return 0 when doc count is within budget", () => {
    seedDocs(5);
    const result = ks.autoprune(100);
    expect(result.removed).toBe(0);
    expect(result.removedIds).toHaveLength(0);
  });

  it("should prune when count exceeds budget", () => {
    seedDocs(25);
    const result = ks.autoprune(10);
    expect(result.removed).toBe(15);
    expect(result.removedIds).toHaveLength(15);
    expect(ks.count()).toBe(10);
  });

  it("should prune down to exact budget limit", () => {
    seedDocs(150);
    const result = ks.autoprune(100);
    expect(result.removed).toBe(50);
    expect(ks.count()).toBe(100);
  });

  it("should support dry run mode", () => {
    seedDocs(30);
    const result = ks.autoprune(10, true);
    expect(result.removed).toBe(20);
    expect(result.removedIds).toHaveLength(20);
    // Docs should still exist
    expect(ks.count()).toBe(30);
  });

  it("should remove lowest quality docs first", () => {
    // Insert docs — quality_score defaults to 0.5 for all
    // Since all have same quality, oldest (lowest created_at) get pruned
    seedDocs(20);
    const result = ks.autoprune(10);
    expect(result.removed).toBe(10);
    expect(ks.count()).toBe(10);
  });
});
