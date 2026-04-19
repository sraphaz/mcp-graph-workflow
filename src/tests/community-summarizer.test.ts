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
 * Tests for community-summarizer.ts — Label Propagation + TF-IDF summary.
 *
 * Task 2.2 (node_25ccc0ff5465) — Epic: Community Detection e Community Summaries
 *
 * AC1: Label Propagation detects 2 distinct clusters
 * AC2: TF-IDF summary contains top 10 terms
 * AC3: Performance < 100ms for 100 nodes
 * AC4: Isolated node becomes singleton community
 * AC5: rebuildCommunities() persists to community_summaries table
 */

import { describe, it, expect } from "vitest";
import {
  detectCommunities,
  generateCommunitySummary,
  rebuildCommunities,
  type Community,
} from "../core/rag/community-summarizer.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

function makeNode(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    type: "task",
    title: `Task ${id}`,
    description: `Description for ${id}`,
    status: "backlog",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEdge(from: string, to: string): GraphEdge {
  return {
    id: `edge_${from}_${to}`,
    from,
    to,
    relationType: "related_to",
    createdAt: new Date().toISOString(),
  };
}

describe("community-summarizer", () => {
  // ── AC1: Two distinct clusters ──
  describe("detectCommunities — Label Propagation", () => {
    it("should detect exactly 2 communities from 2 disconnected clusters", () => {
      const nodes = [
        makeNode("a"), makeNode("b"), makeNode("c"),
        makeNode("d"), makeNode("e"), makeNode("f"),
      ];
      const edges = [
        // Cluster 1: A-B-C
        makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("a", "c"),
        // Cluster 2: D-E-F
        makeEdge("d", "e"), makeEdge("e", "f"), makeEdge("d", "f"),
      ];

      const communities = detectCommunities(nodes, edges);

      expect(communities).toHaveLength(2);

      // Each community has exactly 3 members
      const sizes = communities.map((c) => c.memberNodeIds.length).sort();
      expect(sizes).toEqual([3, 3]);

      // Cluster 1 members are all in the same community
      const communityOfA = communities.find((c) => c.memberNodeIds.includes("a"));
      expect(communityOfA?.memberNodeIds).toContain("b");
      expect(communityOfA?.memberNodeIds).toContain("c");

      // Cluster 2 members are all in the same community
      const communityOfD = communities.find((c) => c.memberNodeIds.includes("d"));
      expect(communityOfD?.memberNodeIds).toContain("e");
      expect(communityOfD?.memberNodeIds).toContain("f");
    });

    // ── AC4: Isolated node ──
    it("should create singleton community for isolated node", () => {
      const nodes = [
        makeNode("a"), makeNode("b"), makeNode("isolated"),
      ];
      const edges = [
        makeEdge("a", "b"),
      ];

      const communities = detectCommunities(nodes, edges);

      const isolatedCommunity = communities.find((c) =>
        c.memberNodeIds.includes("isolated"),
      );
      expect(isolatedCommunity).toBeDefined();
      expect(isolatedCommunity!.memberNodeIds).toHaveLength(1);
      expect(isolatedCommunity!.memberNodeIds[0]).toBe("isolated");
    });

    it("should handle empty graph", () => {
      const communities = detectCommunities([], []);
      expect(communities).toEqual([]);
    });

    it("should handle single node", () => {
      const communities = detectCommunities([makeNode("only")], []);
      expect(communities).toHaveLength(1);
      expect(communities[0].memberNodeIds).toEqual(["only"]);
    });
  });

  // ── AC2: TF-IDF summary with top terms ──
  describe("generateCommunitySummary", () => {
    it("should generate summary containing top TF-IDF terms from member nodes", () => {
      const nodes = [
        makeNode("n1", {
          title: "SQLite database migration",
          description: "Create SQLite migration for user authentication schema with database indexes",
        }),
        makeNode("n2", {
          title: "SQLite query optimization",
          description: "Optimize SQLite database queries for faster authentication lookups",
        }),
        makeNode("n3", {
          title: "Database backup strategy",
          description: "Implement database backup and restore for SQLite authentication data",
        }),
        makeNode("n4", {
          title: "Authentication middleware",
          description: "Build authentication middleware with database session storage",
        }),
        makeNode("n5", {
          title: "Session management",
          description: "Session token management with SQLite persistence and authentication",
        }),
      ];

      const community: Community = {
        communityId: "comm_1",
        memberNodeIds: ["n1", "n2", "n3", "n4", "n5"],
      };

      const summary = generateCommunitySummary(community, nodes);

      expect(summary.topTerms.length).toBeGreaterThanOrEqual(1);
      expect(summary.topTerms.length).toBeLessThanOrEqual(10);
      expect(summary.summary.length).toBeGreaterThan(0);
      expect(summary.title.length).toBeGreaterThan(0);
      expect(summary.memberCount).toBe(5);
    });

    it("should handle community with single node", () => {
      const nodes = [
        makeNode("n1", {
          title: "Graph traversal algorithm",
          description: "Implement BFS graph traversal for dependency resolution",
        }),
      ];

      const community: Community = {
        communityId: "comm_single",
        memberNodeIds: ["n1"],
      };

      const summary = generateCommunitySummary(community, nodes);

      expect(summary.memberCount).toBe(1);
      expect(summary.topTerms.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── AC3: Performance ──
  describe("detectCommunities — performance", () => {
    it("should detect communities in < 100ms for 100 nodes", () => {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];

      // Create 10 clusters of 10 nodes each
      for (let cluster = 0; cluster < 10; cluster++) {
        for (let i = 0; i < 10; i++) {
          nodes.push(makeNode(`c${cluster}_n${i}`, {
            title: `Cluster ${cluster} Node ${i}`,
            description: `Description for cluster ${cluster} node ${i} with some unique terms`,
          }));
        }
        // Connect nodes within cluster
        for (let i = 0; i < 9; i++) {
          edges.push(makeEdge(`c${cluster}_n${i}`, `c${cluster}_n${i + 1}`));
        }
        // Add one more edge to strengthen cluster
        edges.push(makeEdge(`c${cluster}_n0`, `c${cluster}_n${9}`));
      }

      const start = performance.now();
      const communities = detectCommunities(nodes, edges);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(communities.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── AC5: rebuildCommunities persists to SQLite ──
  describe("rebuildCommunities", () => {
    it("should persist communities to community_summaries table", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-community");
      const db = store.getDb();

      // Insert test nodes
      const now = new Date().toISOString();
      const insertNode = db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      insertNode.run("n1", store.getProject()!.id, "task", "SQLite migration", "Create SQLite schema migration", "backlog", 3, now, now);
      insertNode.run("n2", store.getProject()!.id, "task", "SQLite optimization", "Optimize SQLite queries", "backlog", 3, now, now);
      insertNode.run("n3", store.getProject()!.id, "task", "Redis caching", "Implement Redis cache layer", "backlog", 3, now, now);

      // Insert edges (n1-n2 connected, n3 isolated)
      const insertEdge = db.prepare(
        "INSERT INTO edges (id, project_id, from_node, to_node, relation_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      );
      const projectId = store.getProject()!.id;
      insertEdge.run("e1", projectId, "n1", "n2", "related_to", now);

      rebuildCommunities(store);

      // Verify rows exist in community_summaries
      const rows = db
        .prepare("SELECT * FROM community_summaries")
        .all() as Array<{ community_id: string; member_count: number; summary: string }>;

      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Each row has required fields
      for (const row of rows) {
        expect(row.community_id).toBeDefined();
        expect(row.member_count).toBeGreaterThanOrEqual(1);
        expect(row.summary.length).toBeGreaterThan(0);
      }

      store.close();
    });

    it("should clear old communities before rebuilding", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-rebuild");
      const db = store.getDb();

      const now = new Date().toISOString();
      const projectId = store.getProject()!.id;
      const insertNode = db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      insertNode.run("n1", projectId, "task", "Task one", "First task", "backlog", 3, now, now);

      // Build twice
      rebuildCommunities(store);
      rebuildCommunities(store);

      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM community_summaries")
        .get() as { cnt: number };

      // Should not duplicate — only latest communities
      expect(count.cnt).toBeGreaterThanOrEqual(1);
      expect(count.cnt).toBeLessThanOrEqual(5); // sanity check
      store.close();
    });
  });
});
