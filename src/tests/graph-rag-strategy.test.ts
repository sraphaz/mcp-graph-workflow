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
import { makeNode, makeEdge } from "./helpers/factories.js";
import {
  executionGraphSearch,
  graphProximityScore,
  detectCommunities,
  findCommunityDocs,
} from "../core/rag/graph-rag-strategy.js";

describe("Graph RAG Strategy", () => {
  let store: SqliteStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("graph-rag-test");
    ks = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  describe("executionGraphSearch", () => {
    it("should find knowledge docs linked to matching execution graph nodes", () => {
      // Arrange: create execution graph nodes
      const authTask = makeNode({
        id: "task-auth",
        title: "Implement JWT authentication",
        description: "Add JWT-based authentication to the API",
        status: "in_progress",
        priority: 1,
      });
      const authSubtask = makeNode({
        id: "task-auth-test",
        type: "subtask",
        title: "Write auth unit tests",
        status: "ready",
        priority: 2,
        parentId: "task-auth",
      });
      store.insertNode(authTask);
      store.insertNode(authSubtask);

      // Link knowledge docs to these nodes
      ks.insert({
        sourceType: "memory",
        sourceId: "mem:auth-decision",
        title: "Auth architecture decision",
        content: "Decided to use JWT with RS256 for API auth. Tokens expire in 1h.",
        metadata: { nodeId: "task-auth" },
      });
      ks.insert({
        sourceType: "code_context",
        sourceId: "code:auth-middleware",
        title: "Auth middleware implementation",
        content: "Express middleware that validates JWT tokens from Authorization header",
        metadata: { nodeId: "task-auth" },
      });

      // Act
      const results = executionGraphSearch(store.getDb(), store, "JWT authentication");

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.strategies.includes("exec_graph"))).toBe(true);
    });

    it("should expand to parent and child nodes for deeper context", () => {
      // Arrange: epic → task hierarchy
      const epic = makeNode({
        id: "epic-api",
        type: "epic",
        title: "REST API Development",
        description: "Build the complete REST API layer",
        status: "in_progress",
        priority: 1,
      });
      const task = makeNode({
        id: "task-endpoints",
        title: "Create API endpoints",
        status: "in_progress",
        priority: 1,
        parentId: "epic-api",
      });
      store.insertNode(epic);
      store.insertNode(task);

      // Knowledge linked to parent epic
      ks.insert({
        sourceType: "prd",
        sourceId: "prd:api-spec",
        title: "API specification",
        content: "REST API must support CRUD operations for users and projects",
        metadata: { nodeId: "epic-api" },
      });

      // Act: search query matches the child task, should expand to parent
      const results = executionGraphSearch(store.getDb(), store, "API endpoints");

      // Assert: should find knowledge linked to the parent epic
      expect(results.some((r) => r.title === "API specification")).toBe(true);
    });

    it("should follow dependency edges for related context", () => {
      // Arrange: task-B depends_on task-A
      const taskDb = makeNode({
        id: "task-db",
        title: "Set up database schema",
        status: "done",
        priority: 1,
      });
      const taskApi = makeNode({
        id: "task-api",
        title: "Build API layer",
        status: "in_progress",
        priority: 2,
      });
      store.insertNode(taskDb);
      store.insertNode(taskApi);
      store.insertEdge(makeEdge("task-api", "task-db", { id: "edge-dep", relationType: "depends_on" }));

      // Knowledge linked to the dependency
      ks.insert({
        sourceType: "memory",
        sourceId: "mem:db-schema",
        title: "Database schema decisions",
        content: "Using SQLite with FTS5 for full-text search. Schema includes nodes and edges tables.",
        metadata: { nodeId: "task-db" },
      });

      // Act: search for API layer should also find dependency context
      const results = executionGraphSearch(store.getDb(), store, "API layer");

      // Assert: should include knowledge from the dependency
      expect(results.some((r) => r.title === "Database schema decisions")).toBe(true);
    });

    it("should return empty array when no execution graph nodes match", () => {
      const results = executionGraphSearch(store.getDb(), store, "nonexistent xyz topic");
      expect(results).toEqual([]);
    });

    it("should respect the limit parameter", () => {
      // Arrange: create many linked nodes and docs
      for (let i = 0; i < 10; i++) {
        store.insertNode(
          makeNode({
            id: `task-search-${i}`,
            title: `Search feature ${i}`,
            status: "ready",
            priority: 3,
          }),
        );
        ks.insert({
          sourceType: "memory",
          sourceId: `mem:search-${i}`,
          title: `Search decision ${i}`,
          content: `Search implementation detail number ${i} with BM25 ranking and FTS5`,
          metadata: { nodeId: `task-search-${i}` },
        });
      }

      const results = executionGraphSearch(store.getDb(), store, "search feature", { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("graphProximityScore", () => {
    it("should return 1.0 for direct node match (distance 0)", () => {
      expect(graphProximityScore(0)).toBe(1.0);
    });

    it("should return decreasing scores for increasing distance", () => {
      const d0 = graphProximityScore(0);
      const d1 = graphProximityScore(1);
      const d2 = graphProximityScore(2);
      const d3 = graphProximityScore(3);

      expect(d0).toBeGreaterThan(d1);
      expect(d1).toBeGreaterThan(d2);
      expect(d2).toBeGreaterThan(d3);
    });

    it("should always return a positive score", () => {
      expect(graphProximityScore(10)).toBeGreaterThan(0);
    });
  });

  describe("detectCommunities", () => {
    it("should group nodes by parent epic into communities", () => {
      // Arrange: epic with 2 tasks
      store.insertNode(makeNode({ id: "epic-auth", type: "epic", title: "Authentication Epic" }));
      store.insertNode(makeNode({ id: "task-login", title: "Login page", parentId: "epic-auth" }));
      store.insertNode(makeNode({ id: "task-signup", title: "Signup flow", parentId: "epic-auth" }));

      ks.insert({
        sourceType: "memory",
        sourceId: "mem:auth",
        title: "Auth decision",
        content: "Using JWT",
        metadata: { nodeId: "task-login" },
      });

      const communities = detectCommunities(store.getDb(), store);

      expect(communities.length).toBeGreaterThanOrEqual(1);
      const authCommunity = communities.find((c) => c.label === "Authentication Epic");
      expect(authCommunity).toBeDefined();
      expect(authCommunity!.nodeIds.length).toBeGreaterThanOrEqual(2);
      expect(authCommunity!.docIds.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle orphan nodes without parent epic", () => {
      store.insertNode(makeNode({ id: "orphan-task", title: "Standalone task" }));

      const communities = detectCommunities(store.getDb(), store);
      expect(communities.length).toBeGreaterThanOrEqual(1);
    });

    it("should return empty for empty graph", () => {
      const communities = detectCommunities(store.getDb(), store);
      expect(communities).toHaveLength(0);
    });
  });

  describe("findCommunityDocs", () => {
    it("should return docs from the same community as the query match", () => {
      // Arrange: epic with 2 tasks, each with knowledge
      store.insertNode(makeNode({ id: "epic-db", type: "epic", title: "Database Epic" }));
      store.insertNode(makeNode({ id: "task-schema", title: "Design schema", parentId: "epic-db" }));
      store.insertNode(makeNode({ id: "task-migration", title: "Write migrations", parentId: "epic-db" }));

      ks.insert({
        sourceType: "memory",
        sourceId: "mem:schema",
        title: "Schema decision",
        content: "Using SQLite FTS5 for search",
        metadata: { nodeId: "task-schema" },
      });
      const migDoc = ks.insert({
        sourceType: "memory",
        sourceId: "mem:migration",
        title: "Migration notes",
        content: "Migrations handle schema versioning",
        metadata: { nodeId: "task-migration" },
      });

      // Act: search for schema should also return migration docs (same community)
      const docIds = findCommunityDocs(store.getDb(), store, "Design schema");

      expect(docIds.length).toBeGreaterThanOrEqual(1);
      expect(docIds).toContain(migDoc!.id);
    });
  });
});
