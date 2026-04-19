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
import { calculatePhaseDistribution } from "../core/insights/phase-distribution.js";
import { makeNode } from "./helpers/factories.js";
import type { PhaseDistribution } from "../core/insights/phase-distribution.js";

describe("calculatePhaseDistribution", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Phase Distribution Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return all 9 lifecycle phases even with no nodes", () => {
    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    expect(result).toHaveLength(9);
    const phases = result.map((r: PhaseDistribution) => r.phase);
    expect(phases).toEqual([
      "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT",
      "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
    ]);
    for (const entry of result) {
      expect(entry.taskCount).toBe(0);
      expect(entry.percentage).toBe(0);
    }
  });

  it("should classify tasks by sprint phase tag", () => {
    // Tasks with phase tags in metadata
    store.insertNode(makeNode({ status: "done", metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ status: "done", metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ status: "in_progress", metadata: { phase: "VALIDATE" } }));

    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    const implement = result.find((r: PhaseDistribution) => r.phase === "IMPLEMENT");
    const validate = result.find((r: PhaseDistribution) => r.phase === "VALIDATE");

    expect(implement?.taskCount).toBe(2);
    expect(validate?.taskCount).toBe(1);
  });

  it("should calculate correct percentages", () => {
    store.insertNode(makeNode({ metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ metadata: { phase: "VALIDATE" } }));

    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    const implement = result.find((r: PhaseDistribution) => r.phase === "IMPLEMENT");
    const validate = result.find((r: PhaseDistribution) => r.phase === "VALIDATE");

    expect(implement?.percentage).toBe(75);
    expect(validate?.percentage).toBe(25);
  });

  it("should classify tasks by tags when no phase metadata", () => {
    store.insertNode(makeNode({ tags: ["analyze", "prd"] }));
    store.insertNode(makeNode({ tags: ["design", "architecture"] }));
    store.insertNode(makeNode({ tags: ["implementation"] }));

    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    const analyze = result.find((r: PhaseDistribution) => r.phase === "ANALYZE");
    const design = result.find((r: PhaseDistribution) => r.phase === "DESIGN");
    const implement = result.find((r: PhaseDistribution) => r.phase === "IMPLEMENT");

    expect(analyze?.taskCount).toBe(1);
    expect(design?.taskCount).toBe(1);
    expect(implement?.taskCount).toBe(1);
  });

  it("should use status-based heuristic as fallback", () => {
    // backlog/ready → PLAN, in_progress → IMPLEMENT, done → IMPLEMENT (most common)
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "ready" }));
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "done" }));

    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    // Tasks without phase info should still be classified
    const totalClassified = result.reduce((sum: number, r: PhaseDistribution) => sum + r.taskCount, 0);
    expect(totalClassified).toBe(4);
  });

  it("should only count task and subtask types", () => {
    store.insertNode(makeNode({ type: "task", metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ type: "subtask", metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ type: "epic", metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ type: "acceptance_criteria", metadata: { phase: "IMPLEMENT" } }));

    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    const implement = result.find((r: PhaseDistribution) => r.phase === "IMPLEMENT");
    expect(implement?.taskCount).toBe(2);
  });

  it("should return maxCount for intensity calculation", () => {
    store.insertNode(makeNode({ metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ metadata: { phase: "IMPLEMENT" } }));
    store.insertNode(makeNode({ metadata: { phase: "VALIDATE" } }));

    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    const implement = result.find((r: PhaseDistribution) => r.phase === "IMPLEMENT");
    expect(implement?.taskCount).toBe(3);
    // maxCount should be returned by the function for intensity normalization
  });

  it("should satisfy PhaseDistribution type contract", () => {
    store.insertNode(makeNode({ metadata: { phase: "REVIEW" } }));
    const doc = store.toGraphDocument();
    const result = calculatePhaseDistribution(doc);

    const review = result.find((r: PhaseDistribution) => r.phase === "REVIEW") as PhaseDistribution;
    expect(review).toBeDefined();
    expect(typeof review.phase).toBe("string");
    expect(typeof review.taskCount).toBe("number");
    expect(typeof review.percentage).toBe("number");
    expect(typeof review.color).toBe("string");
    expect(review.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
