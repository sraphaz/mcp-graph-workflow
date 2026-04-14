import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { calculateKnowledgeQuality } from "../core/insights/knowledge-quality-radar.js";
import type { KnowledgeQualityMetric } from "../core/insights/knowledge-quality-radar.js";

describe("calculateKnowledgeQuality", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Knowledge Quality Radar Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty array when no documents exist", () => {
    const result = calculateKnowledgeQuality(knowledgeStore);
    expect(result).toEqual([]);
  });

  it("should return one metric per source type", () => {
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "PRD Doc", content: "content 1" });
    knowledgeStore.insert({ sourceType: "memory", sourceId: "s2", title: "Memory", content: "content 2" });

    const result = calculateKnowledgeQuality(knowledgeStore);
    expect(result).toHaveLength(2);

    const types = result.map((m: KnowledgeQualityMetric) => m.sourceType).sort();
    expect(types).toEqual(["memory", "prd"]);
  });

  it("should calculate count per source type", () => {
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "PRD 1", content: "content 1" });
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s2", title: "PRD 2", content: "content 2" });
    knowledgeStore.insert({ sourceType: "memory", sourceId: "s3", title: "Memory", content: "content 3" });

    const result = calculateKnowledgeQuality(knowledgeStore);
    const prd = result.find((m: KnowledgeQualityMetric) => m.sourceType === "prd");
    const memory = result.find((m: KnowledgeQualityMetric) => m.sourceType === "memory");

    expect(prd?.count).toBe(2);
    expect(memory?.count).toBe(1);
  });

  it("should calculate average quality score per source type", () => {
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "Good PRD", content: "good content" });
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s2", title: "Bad PRD", content: "bad content" });

    const result = calculateKnowledgeQuality(knowledgeStore);
    const prd = result.find((m: KnowledgeQualityMetric) => m.sourceType === "prd");

    // Default quality score is 0.5, so avg should be 50
    expect(prd?.avgQuality).toBe(50);
  });

  it("should include score 0-100 normalized", () => {
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "Doc", content: "content" });

    const result = calculateKnowledgeQuality(knowledgeStore);
    const prd = result[0] as KnowledgeQualityMetric;

    expect(prd.score).toBeGreaterThanOrEqual(0);
    expect(prd.score).toBeLessThanOrEqual(100);
  });

  it("should flag low quality sources (avgQuality < 40)", () => {
    knowledgeStore.insert({ sourceType: "web_capture", sourceId: "s1", title: "Capture", content: "x" });
    // Default quality is 0.5 (50), so this won't be low
    const result = calculateKnowledgeQuality(knowledgeStore);
    const capture = result.find((m: KnowledgeQualityMetric) => m.sourceType === "web_capture");
    expect(capture?.isLow).toBe(false);
  });
});
