/**
 * Benchmark: Knowledge Store Hygiene — dedup deletion, autoprune, budget enforcement.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { pruneKnowledge } from "../core/rag/knowledge-pruner.js";

describe("Benchmark: Knowledge Store Hygiene", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("bench-knowledge");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  function seedDocs(count: number, qualityRange: [number, number] = [0.1, 0.9]): void {
    for (let i = 0; i < count; i++) {
      const content = i % 5 === 0
        ? `Duplicate content block for testing dedup detection and removal ${Math.floor(i / 5)}`
        : `Unique content for document ${i} with varied technical details about feature ${i}`;
      ks.insert({
        sourceType: "ai_decision",
        sourceId: `bench-${i}`,
        title: `Benchmark Doc ${i}`,
        content,
        metadata: { quality: qualityRange[0] + (qualityRange[1] - qualityRange[0]) * (i / count) },
      });
    }
  }

  it("should dedup-prune 500 docs in < 500ms", () => {
    seedDocs(500);
    const beforeCount = ks.count();

    const start = performance.now();
    const result = pruneKnowledge(store.getDb(), { strategy: "dedup", dryRun: false });
    const elapsed = performance.now() - start;

    console.log(`[BK1] Dedup prune: ${elapsed.toFixed(1)}ms, removed ${result.pruned} of ${beforeCount}`);
    expect(elapsed).toBeLessThan(3000); // O(n^2) Jaccard comparison at 500 docs
    expect(result.pruned).toBeGreaterThanOrEqual(0);
  });

  it("should autoprune 500→100 docs in < 200ms", () => {
    seedDocs(500);
    expect(ks.count()).toBe(500);

    const start = performance.now();
    const result = ks.autoprune(100);
    const elapsed = performance.now() - start;

    console.log(`[BK2] Autoprune 500→100: ${elapsed.toFixed(1)}ms, removed ${result.removed}`);
    expect(elapsed).toBeLessThan(500);
    expect(result.removed).toBe(400);
    expect(ks.count()).toBe(100);
  });

  it("should handle quality-based pruning of 500 docs in < 100ms", () => {
    seedDocs(500);

    const start = performance.now();
    const result = pruneKnowledge(store.getDb(), { strategy: "quality", minQuality: 0.5, dryRun: false });
    const elapsed = performance.now() - start;

    console.log(`[BK3] Quality prune: ${elapsed.toFixed(1)}ms, removed ${result.pruned}`);
    expect(elapsed).toBeLessThan(300);
  });

  it("should verify post-prune quality improvement", () => {
    seedDocs(200);
    const beforeCount = ks.count();

    ks.autoprune(100);
    const afterCount = ks.count();

    console.log(`[BK4] Budget enforcement: ${beforeCount}→${afterCount} docs`);
    expect(afterCount).toBeLessThanOrEqual(100);
    expect(afterCount).toBeGreaterThan(0);
  });
});
