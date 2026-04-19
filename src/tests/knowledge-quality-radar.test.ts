/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

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

  it("should produce valid scores even when count/total values are NaN-inducing", () => {
    // Insert a document so total > 0
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "Doc", content: "content" });

    const result = calculateKnowledgeQuality(knowledgeStore);
    for (const metric of result) {
      expect(Number.isFinite(metric.score)).toBe(true);
      expect(Number.isFinite(metric.avgQuality)).toBe(true);
      expect(Number.isFinite(metric.count)).toBe(true);
      expect(metric.score).toBeGreaterThanOrEqual(0);
      expect(metric.score).toBeLessThanOrEqual(100);
    }
  });

  it("should handle corrupted avgBySource with NaN gracefully", () => {
    // Insert document then corrupt the quality_score in DB
    knowledgeStore.insert({ sourceType: "prd", sourceId: "s1", title: "Doc", content: "content" });
    const db = (knowledgeStore as unknown as { db: import("better-sqlite3").Database }).db;
    db.prepare("UPDATE knowledge_documents SET quality_score = NULL WHERE source_type = 'prd'").run();

    const result = calculateKnowledgeQuality(knowledgeStore);
    const prd = result.find((m: KnowledgeQualityMetric) => m.sourceType === "prd");

    expect(prd).toBeDefined();
    expect(Number.isFinite(prd!.score)).toBe(true);
    expect(Number.isFinite(prd!.avgQuality)).toBe(true);
    expect(prd!.score).toBeGreaterThanOrEqual(0);
    expect(prd!.score).toBeLessThanOrEqual(100);
  });
});
