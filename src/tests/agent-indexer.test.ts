/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T04 — Agent indexer tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexAgents, agentSourceId } from "../core/rag/agent-indexer.js";
import type { AgentDefinition } from "../schemas/agent.schema.js";

function makeAgent(over: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: "prd-analyst",
    description: "Analyzes PRDs",
    tools: [],
    systemPrompt: "You analyze PRDs and decompose them.",
    phase: "ANALYZE",
    ...over,
  } as AgentDefinition;
}

describe("agent-indexer (E2.T04)", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("indexes a single agent and reports it as queryable in the knowledge store", () => {
    const r = indexAgents(store, [{ agent: makeAgent(), body: "step 1" }]);
    expect(r.agentsScanned).toBe(1);
    expect(r.documentsIndexed).toBeGreaterThan(0);
    expect(store.count("agent")).toBe(r.documentsIndexed);
  });

  it("namespaces by lifecycle phase via sourceId", () => {
    const a = makeAgent({ name: "a", phase: "ANALYZE" });
    const b = makeAgent({ name: "a", phase: "DESIGN" });
    expect(agentSourceId(a)).toBe("agent:ANALYZE:a");
    expect(agentSourceId(b)).toBe("agent:DESIGN:a");

    const r = indexAgents(store, [
      { agent: a, body: "x" },
      { agent: b, body: "y" },
    ]);
    expect(r.namespaces).toEqual(["ANALYZE", "DESIGN"]);
  });

  it("re-index is idempotent: second run reports 0 new docs and dedup count > 0", () => {
    const inputs = [{ agent: makeAgent(), body: "stable body" }];
    const first = indexAgents(store, inputs);
    expect(first.documentsIndexed).toBeGreaterThan(0);

    const second = indexAgents(store, inputs);
    expect(second.documentsIndexed).toBe(0);
    expect(second.skippedDuplicates).toBeGreaterThan(0);
    // total rows in the store unchanged
    expect(store.count("agent")).toBe(first.documentsIndexed);
  });

  it("indexed agent docs are retrievable via list(sourceType:'agent')", () => {
    indexAgents(store, [{ agent: makeAgent(), body: "hello" }]);
    const docs = store.list({ sourceType: "agent", limit: 50 });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].sourceType).toBe("agent");
    expect(docs[0].metadata?.phase).toBe("ANALYZE");
  });

  it("two distinct agents in the same phase create separate sourceIds", () => {
    const r = indexAgents(store, [
      { agent: makeAgent({ name: "alpha" }), body: "a" },
      { agent: makeAgent({ name: "beta" }), body: "b" },
    ]);
    expect(r.documentsIndexed).toBeGreaterThanOrEqual(2);
    const docs = store.list({ sourceType: "agent", limit: 50 });
    const sourceIds = new Set(docs.map((d) => d.sourceId));
    expect(sourceIds.has("agent:ANALYZE:alpha")).toBe(true);
    expect(sourceIds.has("agent:ANALYZE:beta")).toBe(true);
  });
});
