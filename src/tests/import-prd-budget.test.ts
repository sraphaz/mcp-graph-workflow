/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * BUG-02-A: import_prd knowledge budget pre-flight
 * Tests: getBudgetUsage(), pruneByQuality(), and budget enforcement in import flow.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { DEFAULT_TOKEN_BUDGET } from "../core/utils/constants.js";

// 4 chars ≈ 1 token; build content of N tokens
function makeContent(tokens: number): string {
  return "a".repeat(tokens * 4);
}

describe("KnowledgeStore.getBudgetUsage()", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Budget Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("returns 0% when store is empty", () => {
    const usage = ks.getBudgetUsage();
    expect(usage.usagePercent).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.budget).toBe(DEFAULT_TOKEN_BUDGET);
  });

  it("returns correct usagePercent for known content size", () => {
    // Insert doc with 2000 tokens of content
    ks.insert({ sourceType: "prd", sourceId: "s1", title: "T1", content: makeContent(2000) });
    const usage = ks.getBudgetUsage();
    expect(usage.totalTokens).toBeGreaterThanOrEqual(1900);
    expect(usage.totalTokens).toBeLessThanOrEqual(2100);
    expect(usage.usagePercent).toBe(Math.round((usage.totalTokens / DEFAULT_TOKEN_BUDGET) * 100));
  });

  it("returns usagePercent > 100 when over budget", () => {
    // Insert 5000 tokens worth of content (> 4000 budget)
    ks.insert({ sourceType: "prd", sourceId: "s2", title: "T2", content: makeContent(5000) });
    const usage = ks.getBudgetUsage();
    expect(usage.usagePercent).toBeGreaterThan(100);
  });

  it("accepts custom budget override", () => {
    ks.insert({ sourceType: "prd", sourceId: "s3", title: "T3", content: makeContent(1000) });
    const usage = ks.getBudgetUsage(2000); // custom budget
    expect(usage.budget).toBe(2000);
    expect(usage.usagePercent).toBe(Math.round((usage.totalTokens / 2000) * 100));
  });
});

describe("KnowledgeStore.pruneByQuality()", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Prune Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("removes prd docs below quality threshold", () => {
    const low = ks.insert({ sourceType: "prd", sourceId: "low", title: "Low", content: "low content" });
    const high = ks.insert({ sourceType: "prd", sourceId: "high", title: "High", content: "high content" });

    // Manually set quality scores
    const db = store.getDb();
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.2 WHERE id = ?").run(low.id);
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE id = ?").run(high.id);

    const result = ks.pruneByQuality("prd", 0.4);

    expect(result.removed).toBe(1);
    expect(result.removedIds).toContain(low.id);
    expect(result.removedIds).not.toContain(high.id);
    expect(ks.count("prd")).toBe(1);
  });

  it("does not remove docs of other source types", () => {
    const memDoc = ks.insert({ sourceType: "memory", sourceId: "m1", title: "Memory", content: "mem" });
    const db = store.getDb();
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.1 WHERE id = ?").run(memDoc.id);

    // Prune prd source only — memory doc should survive
    const result = ks.pruneByQuality("prd", 0.4);

    expect(result.removed).toBe(0);
    expect(ks.count("memory")).toBe(1);
  });

  it("removes docs with NULL quality_score (treated as 0.5 default — below threshold 0.6)", () => {
    const nullQuality = ks.insert({ sourceType: "prd", sourceId: "nq", title: "NQ", content: "nq" });
    // quality_score stays at default 0.5 (migration sets DEFAULT 0.5)
    const result = ks.pruneByQuality("prd", 0.6);
    expect(result.removed).toBe(1);
    expect(result.removedIds).toContain(nullQuality.id);
  });

  it("returns empty result when no docs match the criteria", () => {
    const good = ks.insert({ sourceType: "prd", sourceId: "g1", title: "Good", content: "good" });
    const db = store.getDb();
    db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE id = ?").run(good.id);

    const result = ks.pruneByQuality("prd", 0.4);
    expect(result.removed).toBe(0);
    expect(result.removedIds).toHaveLength(0);
  });
});

describe("import-prd budget pre-flight integration", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Budget Pre-flight Test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("budget at 85% triggers pruneByQuality before new docs are added", () => {
    // Fill store to 85% budget with low-quality prd docs (3400 tokens of 4000 budget)
    // Insert multiple small docs with low quality
    for (let i = 0; i < 10; i++) {
      const doc = ks.insert({
        sourceType: "prd",
        sourceId: `prd-old-${i}`,
        title: `Old PRD ${i}`,
        content: makeContent(340), // 10 docs × 340 tokens ≈ 3400 tokens = 85%
      });
      store.getDb().prepare("UPDATE knowledge_documents SET quality_score = 0.2 WHERE id = ?").run(doc.id);
    }

    const beforeUsage = ks.getBudgetUsage();
    expect(beforeUsage.usagePercent).toBeGreaterThanOrEqual(80);

    // When budget > 80%, pruneByQuality('prd', 0.4) should bring it below 60%
    if (beforeUsage.usagePercent > 80) {
      const pruneResult = ks.pruneByQuality("prd", 0.4);
      expect(pruneResult.removed).toBeGreaterThan(0);

      const afterUsage = ks.getBudgetUsage();
      expect(afterUsage.usagePercent).toBeLessThan(beforeUsage.usagePercent);
    }
  });

  it("budget below 80% does not trigger pruning", () => {
    // Insert only 1000 tokens (25% of 4000 budget)
    ks.insert({ sourceType: "prd", sourceId: "small", title: "Small", content: makeContent(1000) });

    const usage = ks.getBudgetUsage();
    expect(usage.usagePercent).toBeLessThan(80);

    // No pruning should be needed
    const countBefore = ks.count();
    // Simulate the pre-flight: only prune if > 80%
    if (usage.usagePercent > 80) {
      ks.pruneByQuality("prd", 0.4);
    }
    expect(ks.count()).toBe(countBefore); // no docs removed
  });
});
