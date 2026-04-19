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
import { assessRisks } from "../core/analyzer/risk-assessment.js";
import { makeNode } from "./helpers/factories.js";

describe("assessRisks", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Risk Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty risks for graph without risk nodes", () => {
    store.insertNode(makeNode({ type: "task", title: "Task" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it("should assess risk nodes with default scoring", () => {
    store.insertNode(makeNode({ type: "risk", title: "Generic risk" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks).toHaveLength(1);
    expect(result.risks[0].probability).toBe(3);
    expect(result.risks[0].impact).toBe(3);
    expect(result.risks[0].score).toBe(9);
    expect(result.risks[0].level).toBe("high");
  });

  it("should score higher probability for high-probability keywords", () => {
    store.insertNode(makeNode({ type: "risk", title: "Likely failure in auth" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].probability).toBe(4);
  });

  it("should score higher impact for critical keywords", () => {
    store.insertNode(makeNode({ type: "risk", title: "Potential data loss" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].impact).toBe(4);
  });

  it("should mark risk as mitigated when child task is done", () => {
    const risk = makeNode({ type: "risk", title: "Security risk" });
    const mitigation = makeNode({ type: "task", title: "Security audit", parentId: risk.id, status: "done" });
    store.insertNode(risk);
    store.insertNode(mitigation);

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("mitigated");
    expect(result.summary.mitigated).toBe(1);
  });

  it("should mark risk as partial when child task is in_progress", () => {
    const risk = makeNode({ type: "risk", title: "Performance risk" });
    const mitigation = makeNode({ type: "task", title: "Perf benchmark", parentId: risk.id, status: "in_progress" });
    store.insertNode(risk);
    store.insertNode(mitigation);

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("partial");
  });

  it("should suggest mitigation for unmitigated risks", () => {
    store.insertNode(makeNode({ type: "risk", title: "Security vulnerability" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].suggestedMitigation).toBeDefined();
    expect(result.risks[0].suggestedMitigation).toContain("security");
  });

  it("should sort risks by score descending", () => {
    store.insertNode(makeNode({ type: "risk", title: "Minor cosmetic issue" }));
    store.insertNode(makeNode({ type: "risk", title: "Critical security breach likely" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].score).toBeGreaterThanOrEqual(result.risks[1].score);
  });

  // --- Unified edge-based mitigation (task 8.1) ---

  it("should mark risk as mitigated when linked to decision via edge (unified with tech_risk)", () => {
    const risk = makeNode({ type: "risk", title: "Scaling risk" });
    const decision = makeNode({ type: "decision", title: "ADR: Use caching" });
    store.insertNode(risk);
    store.insertNode(decision);
    store.insertEdge({
      id: "edge_test_1",
      from: decision.id,
      to: risk.id,
      relationType: "implements",
      createdAt: "2025-01-01T00:00:00Z",
    });

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("mitigated");
  });

  it("should mark risk as partial when linked to epic via edge (unified with tech_risk)", () => {
    const risk = makeNode({ type: "risk", title: "Integration risk" });
    const epic = makeNode({ type: "epic", title: "API Integration" });
    store.insertNode(risk);
    store.insertNode(epic);
    store.insertEdge({
      id: "edge_test_2",
      from: risk.id,
      to: epic.id,
      relationType: "related_to",
      createdAt: "2025-01-01T00:00:00Z",
    });

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("partial");
  });

  it("should mark risk as partial when metadata.mitigation is set (unified with tech_risk)", () => {
    const risk = makeNode({ type: "risk", title: "Deployment risk", metadata: { mitigation: "Blue-green deployment strategy" } });
    store.insertNode(risk);

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("partial");
  });

  it("should prefer child task mitigation over edge mitigation", () => {
    const risk = makeNode({ type: "risk", title: "Security risk" });
    const task = makeNode({ type: "task", title: "Audit", parentId: risk.id, status: "done" });
    const epic = makeNode({ type: "epic", title: "Security Epic" });
    store.insertNode(risk);
    store.insertNode(task);
    store.insertNode(epic);
    store.insertEdge({
      id: "edge_test_3",
      from: risk.id,
      to: epic.id,
      relationType: "related_to",
      createdAt: "2025-01-01T00:00:00Z",
    });

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    // Child task done = "mitigated", should not be downgraded by epic edge (partial)
    expect(result.risks[0].mitigationStatus).toBe("mitigated");
  });
});
