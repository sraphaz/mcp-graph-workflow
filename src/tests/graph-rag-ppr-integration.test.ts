/**
 * Tests for PPR integration in graph-rag-strategy.ts.
 *
 * Covers 3 of 4 acceptance criteria (AC4 nDCG requires eval dataset):
 * AC1: PPR ranks by connectivity, not just proximity
 * AC2: Public interface unchanged — no breaking changes
 * AC3: Feature flag ppr: false → legacy BFS scoring
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { makeEdge, makeEpic, makeTask } from "./helpers/factories.js";
import {
  executionGraphSearch,
  graphProximityScore,
} from "../core/rag/graph-rag-strategy.js";

describe("graph-rag-strategy PPR integration", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("ppr-test");

    // Build graph: Epic → Task A, Task B, Task C
    const epic = makeEpic({ id: "epic-1", title: "Auth Epic", description: "Authentication system" });
    const taskA = makeTask({ id: "task-a", title: "Auth basic login", description: "Simple login for authentication", parentId: "epic-1" });
    const taskB = makeTask({ id: "task-b", title: "Auth OAuth provider", description: "OAuth integration for authentication", parentId: "epic-1" });
    const taskC = makeTask({ id: "task-c", title: "Auth SSO SAML", description: "SSO SAML integration for authentication", parentId: "epic-1" });

    store.insertNode(epic);
    store.insertNode(taskA);
    store.insertNode(taskB);
    store.insertNode(taskC);

    // Make Task B more connected (extra edges pointing to it)
    store.insertEdge(makeEdge("task-a", "task-b", { relationType: "depends_on" }));
    store.insertEdge(makeEdge("task-c", "task-b", { relationType: "related_to" }));

    // Insert knowledge docs linked to tasks
    const ks = new KnowledgeStore(store.getDb());
    ks.insert({
      sourceType: "memory",
      sourceId: "doc-a",
      title: "Auth basic login notes",
      content: "Authentication basic login documentation for users and developers",
      metadata: { nodeId: "task-a" },
    });
    ks.insert({
      sourceType: "memory",
      sourceId: "doc-b",
      title: "Auth OAuth notes",
      content: "Authentication OAuth provider documentation for users and developers",
      metadata: { nodeId: "task-b" },
    });
  });

  afterEach(() => {
    store.close();
  });

  // AC2: Public interface unchanged
  it("should maintain existing interface with default options", () => {
    const db = store.getDb();
    const results = executionGraphSearch(db, store, "authentication");

    expect(results).toBeInstanceOf(Array);
    for (const r of results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("score");
      expect(r).toHaveProperty("graphDistance");
      expect(r).toHaveProperty("strategies");
    }
  });

  // AC3: Feature flag ppr: false → uses BFS scoring
  it("should use BFS scoring when ppr is false", () => {
    const db = store.getDb();
    const results = executionGraphSearch(db, store, "auth", { ppr: false });

    for (const r of results) {
      const expectedBfs = graphProximityScore(r.graphDistance);
      expect(r.score).toBe(Math.round(expectedBfs * 10000) / 10000);
    }
  });

  // AC3: PPR flag defaults to false (backward compat)
  it("should default to BFS when ppr option is omitted", () => {
    const db = store.getDb();
    const defaultResults = executionGraphSearch(db, store, "auth");
    const bfsResults = executionGraphSearch(db, store, "auth", { ppr: false });

    expect(defaultResults.map((r) => r.score)).toEqual(bfsResults.map((r) => r.score));
  });

  // AC1: PPR ranks more-connected nodes higher
  it("should rank more-connected node higher with PPR enabled", () => {
    const db = store.getDb();
    const pprResults = executionGraphSearch(db, store, "auth", { ppr: true });

    const docA = pprResults.find((r) => r.linkedNodeId === "task-a");
    const docB = pprResults.find((r) => r.linkedNodeId === "task-b");

    // Task B has more incoming connections → PPR should score it strictly higher than Task A
    expect(docA).toBeDefined();
    expect(docB).toBeDefined();
    expect(docB!.score).toBeGreaterThan(docA!.score);
  });

  // Legacy scoring function preserved
  it("should preserve graphProximityScore function", () => {
    expect(graphProximityScore(0)).toBe(1);
    expect(graphProximityScore(1)).toBe(0.5);
    expect(graphProximityScore(2)).toBeCloseTo(0.333, 2);
  });
});
