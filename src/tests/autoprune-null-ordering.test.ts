import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("autoprune NULL column ordering", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Autoprune NULL Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should prune documents with NULL quality_score first (treated as 0)", () => {
    // Insert docs: one with quality, one without (NULL)
    const goodDoc = knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "good",
      title: "Good Doc",
      content: "high quality content",
    });
    // Set high quality score on the good doc
    const db = store.getDb();
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE id = ?").run(goodDoc.id);

    const nullDoc = knowledgeStore.insert({
      sourceType: "prd",
      sourceId: "null-quality",
      title: "Null Quality Doc",
      content: "null quality content",
    });
    // quality_score stays NULL (default)

    // Budget of 1 should prune the NULL quality doc first
    const result = knowledgeStore.autoprune(1);

    expect(result.removed).toBe(1);
    expect(result.removedIds).toContain(nullDoc.id);
    expect(result.removedIds).not.toContain(goodDoc.id);
  });

  it("should prune documents with NULL usage_count first (treated as 0)", () => {
    const usedDoc = knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "used",
      title: "Used Doc",
      content: "frequently used",
    });
    const db = store.getDb();
    db.prepare("UPDATE knowledge_documents SET usage_count = 10, quality_score = 0.5 WHERE id = ?").run(usedDoc.id);

    const unusedDoc = knowledgeStore.insert({
      sourceType: "memory",
      sourceId: "unused",
      title: "Unused Doc",
      content: "never used",
    });
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.5 WHERE id = ?").run(unusedDoc.id);
    // usage_count stays NULL

    const result = knowledgeStore.autoprune(1);

    expect(result.removed).toBe(1);
    expect(result.removedIds).toContain(unusedDoc.id);
    expect(result.removedIds).not.toContain(usedDoc.id);
  });

  it("should use COALESCE ordering: quality ASC, usage ASC, created_at ASC", () => {
    // Insert 3 docs with different quality scores
    const low = knowledgeStore.insert({ sourceType: "prd", sourceId: "low", title: "Low Q", content: "low" });
    const mid = knowledgeStore.insert({ sourceType: "prd", sourceId: "mid", title: "Mid Q", content: "mid" });
    const high = knowledgeStore.insert({ sourceType: "prd", sourceId: "high", title: "High Q", content: "high" });

    const db = store.getDb();
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.2 WHERE id = ?").run(low.id);
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.5 WHERE id = ?").run(mid.id);
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE id = ?").run(high.id);

    // Prune 2, keep 1 — should keep the highest quality
    const result = knowledgeStore.autoprune(1);

    expect(result.removed).toBe(2);
    expect(result.removedIds).toContain(low.id);
    expect(result.removedIds).toContain(mid.id);
    expect(result.removedIds).not.toContain(high.id);
  });

  it("should not prune when total is within budget", () => {
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "Doc 1", content: "c1" });
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s2", title: "Doc 2", content: "c2" });

    const result = knowledgeStore.autoprune(5);

    expect(result.removed).toBe(0);
    expect(result.removedIds).toEqual([]);
  });
});
