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

/**
 * E2E maestro-loop — V11 Maestro Phase 4.7.
 *
 * Simulates the full agent loop:
 *   1. graph_materialize  → plan-payload  (mcp-graph emits intent)
 *   2. agent executes Write (simulated — just inspects args)
 *   3. agent calls postCallback (finish_task) → node moves to done
 * Assertions:
 *   - Loop closes in < 5s
 *   - Plan validates against PlanPayloadSchema
 *   - Node status transitions in_progress → done
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildMaterializePlan } from "../mcp/tools/graph-materialize.js";
import { PlanPayloadSchema } from "../mcp/contracts/plan-payload.js";

describe("E2E maestro-loop — V11 Maestro Phase 4.7", () => {
  let store: SqliteStore;
  let nodeId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("E2E Project");
    nodeId = "node_e2e";
    store.insertNode({
      id: nodeId,
      type: "task",
      title: "E2E Maestro Task",
      status: "in_progress",
      priority: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    store.close();
  });

  it("closes the maestro loop in < 5s with a valid PlanPayload", async () => {
    const t0 = Date.now();

    // Step 1 — mcp-graph emits the plan-payload (executor=native-write)
    const materialize = buildMaterializePlan(store, {
      nodeId,
      artifact: "mermaid",
      filePath: "/tmp/e2e-graph.mmd",
    });
    expect(materialize.ok).toBe(true);
    if (!materialize.ok) return;

    // Validate the contract (PlanPayloadSchema) — boundary check
    const parsed = PlanPayloadSchema.safeParse(materialize.plan);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Step 2 — agent client "executes" the Write step (we don't actually write —
    // E2E spirit: verify the args the agent would receive are valid).
    const writeStep = materialize.plan.steps[0];
    expect(writeStep.tool).toBe("Write");
    expect(typeof writeStep.args.file_path).toBe("string");
    expect(typeof writeStep.args.content).toBe("string");
    expect((writeStep.args.content as string).length).toBeGreaterThan(0);

    // Step 3 — agent client calls postCallback (finish_task in real world).
    // Here we simulate by calling the underlying store transition; in production,
    // the finish_task handler runs DoD checks + updates status.
    const postCallback = materialize.plan.postCallback;
    expect(postCallback).toBeDefined();
    expect(postCallback?.tool).toBe("finish_task");
    expect((postCallback?.args as { nodeId: string }).nodeId).toBe(nodeId);

    const updated = store.updateNodeStatus(nodeId, "done");
    expect(updated?.status).toBe("done");

    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(5000);
  });

  it("plan-payload includes auditId for traceability", async () => {
    const r = buildMaterializePlan(store, {
      nodeId,
      artifact: "snapshot",
      filePath: "/tmp/e2e-snapshot.json",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.auditId).toMatch(/^[a-f0-9-]{8,}$/);
  });

  it("two distinct calls produce distinct auditIds (UUIDs)", () => {
    const r1 = buildMaterializePlan(store, { nodeId, artifact: "mermaid", filePath: "/tmp/a.mmd" });
    const r2 = buildMaterializePlan(store, { nodeId, artifact: "mermaid", filePath: "/tmp/b.mmd" });
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.plan.auditId).not.toBe(r2.plan.auditId);
  });
});
