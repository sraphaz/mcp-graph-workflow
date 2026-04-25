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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildMaterializePlan } from "../mcp/tools/graph-materialize.js";
import { PlanPayloadSchema } from "../mcp/contracts/plan-payload.js";

describe("graph_materialize — V11 Maestro Phase 4.2", () => {
  let store: SqliteStore;
  let nodeId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
    nodeId = "node_sample";
    store.insertNode({
      id: nodeId,
      type: "task",
      title: "Sample Task",
      status: "backlog",
      priority: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    store.close();
  });

  it("returns a valid PlanPayload for mermaid artifact", () => {
    const r = buildMaterializePlan(store, { nodeId, artifact: "mermaid", filePath: "/tmp/x.mmd" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(PlanPayloadSchema.safeParse(r.plan).success).toBe(true);
    expect(r.plan.executor).toBe("native-write");
    expect(r.plan.nodeId).toBe(nodeId);
  });

  it("step is Write with {file_path, content}", () => {
    const r = buildMaterializePlan(store, { nodeId, artifact: "mermaid", filePath: "/tmp/g.mmd" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.steps.length).toBe(1);
    expect(r.plan.steps[0].tool).toBe("Write");
    expect(r.plan.steps[0].args.file_path).toBe("/tmp/g.mmd");
    expect(typeof r.plan.steps[0].args.content).toBe("string");
    expect((r.plan.steps[0].args.content as string).length).toBeGreaterThan(0);
  });

  it("content for artifact=mermaid starts with a known mermaid header", () => {
    const r = buildMaterializePlan(store, { nodeId, artifact: "mermaid", filePath: "/tmp/g.mmd" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const content = r.plan.steps[0].args.content as string;
    expect(content.toLowerCase()).toMatch(/flowchart|graph|mindmap/);
  });

  it("postCallback is finish_task with the node id", () => {
    const r = buildMaterializePlan(store, { nodeId, artifact: "mermaid", filePath: "/tmp/g.mmd" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.postCallback).toBeDefined();
    expect(r.plan.postCallback?.tool).toBe("finish_task");
    expect((r.plan.postCallback?.args as { nodeId: string }).nodeId).toBe(nodeId);
  });

  it("supports artifact=adr (markdown content)", () => {
    const r = buildMaterializePlan(store, { nodeId, artifact: "adr", filePath: "/tmp/0001.md" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const content = r.plan.steps[0].args.content as string;
    // ADR template should have at least an "ADR" or "## Context" marker
    expect(content).toMatch(/ADR|## Context|Status:/i);
  });

  it("supports artifact=snapshot (JSON content)", () => {
    const r = buildMaterializePlan(store, { nodeId, artifact: "snapshot", filePath: "/tmp/snap.json" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const content = r.plan.steps[0].args.content as string;
    expect(() => JSON.parse(content)).not.toThrow();
    const parsed = JSON.parse(content);
    expect(parsed.nodes).toBeInstanceOf(Array);
  });

  it("returns ok=false when nodeId does not exist", () => {
    const r = buildMaterializePlan(store, { nodeId: "node_missing", artifact: "mermaid", filePath: "/tmp/x.mmd" });
    expect(r.ok).toBe(false);
  });

  it("graph-materialize source has zero direct fs/Write imports (maestro contract)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/mcp/tools/graph-materialize.ts"),
      "utf-8",
    );
    // It may import response-helpers, contracts, etc. — but never fs / fs/promises / Write SDK
    expect(src).not.toMatch(/from\s+['"]node:fs/);
    expect(src).not.toMatch(/from\s+['"]fs['"]/);
    expect(src).not.toMatch(/from\s+['"]fs\/promises/);
  });
});
