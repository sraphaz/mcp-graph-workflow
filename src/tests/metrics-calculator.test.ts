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
import { calculateMetrics } from "../core/insights/metrics-calculator.js";
import { makeNode } from "./helpers/factories.js";

describe("calculateMetrics", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Metrics Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should calculate completion rate", () => {
    store.insertNode(makeNode({ status: "done" }));
    store.insertNode(makeNode({ status: "done" }));
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "in_progress" }));

    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    expect(metrics.totalTasks).toBe(4);
    expect(metrics.completionRate).toBe(50);
  });

  it("should calculate status distribution", () => {
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "backlog" }));
    store.insertNode(makeNode({ status: "done" }));

    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    const backlog = metrics.statusDistribution.find((d) => d.status === "backlog");
    const done = metrics.statusDistribution.find((d) => d.status === "done");

    expect(backlog?.count).toBe(2);
    expect(done?.count).toBe(1);
  });

  it("should calculate sprint progress", () => {
    store.insertNode(makeNode({ sprint: "sprint-1", status: "done" }));
    store.insertNode(makeNode({ sprint: "sprint-1", status: "backlog" }));
    store.insertNode(makeNode({ sprint: "sprint-2", status: "in_progress" }));

    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    expect(metrics.sprintProgress.length).toBe(2);

    const s1 = metrics.sprintProgress.find((s) => s.sprint === "sprint-1");
    expect(s1?.total).toBe(2);
    expect(s1?.done).toBe(1);
    expect(s1?.percentage).toBe(50);
  });

  it("should handle empty graph", () => {
    const doc = store.toGraphDocument();
    const metrics = calculateMetrics(doc);

    expect(metrics.totalNodes).toBe(0);
    expect(metrics.totalTasks).toBe(0);
    expect(metrics.completionRate).toBe(0);
  });
});
