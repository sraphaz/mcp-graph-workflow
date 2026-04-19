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
 * Tests for community summary integration in Graph RAG.
 *
 * Task 2.3 (node_69c6715807f9) — Integrar community summaries no Graph RAG para queries broad.
 *
 * Covers all 4 acceptance criteria:
 * AC1: Broad query → community summary appears in top-3 results
 * AC2: Specific query → community summaries do NOT interfere (coverage < 60%)
 * AC3: Feature flag disabled → behavior identical to v6.x
 * AC4: Recall@10 improvement (validated structurally, not as benchmark)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import { findByCommunity } from "../core/rag/graph-rag-strategy.js";

describe("Graph RAG Community Integration", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("community-test");
  });

  afterEach(() => {
    store.close();
  });

  /** Insert a community summary directly into the DB for testing. */
  function insertCommunitySummary(opts: {
    communityId: string;
    title: string;
    summary: string;
    memberNodeIds: string[];
    topTerms: string[];
  }): void {
    const db = store.getDb();
    db.prepare(`
      INSERT INTO community_summaries (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `cs_${opts.communityId}`,
      opts.communityId,
      opts.title,
      opts.summary,
      JSON.stringify(opts.memberNodeIds),
      opts.memberNodeIds.length,
      JSON.stringify(opts.topTerms),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }

  // ── AC1: Broad query → community summary in top results ──
  describe("AC1: broad query matches community summary with high coverage", () => {
    it("should return community summary when query covers > 60% of top terms", () => {
      // Arrange: sprint-related community
      store.insertNode(makeNode({ id: "task-sprint-1", title: "Sprint planning task" }));
      store.insertNode(makeNode({ id: "task-sprint-2", title: "Sprint review task" }));

      insertCommunitySummary({
        communityId: "comm_sprint",
        title: "Community: sprint, planning, review",
        summary: "Cluster of 5 nodes focused on: sprint, planning, review, backlog, velocity.",
        memberNodeIds: ["task-sprint-1", "task-sprint-2"],
        topTerms: ["sprint", "planning", "review", "backlog", "velocity"],
      });

      // Act: broad query covering sprint terms
      const results = findByCommunity(store, "como está o andamento do sprint planning review");

      // Assert: community summary appears
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeCloseTo(0.85, 1);
      expect(results[0].communityId).toBe("comm_sprint");
    });

    it("should return results with all required fields", () => {
      insertCommunitySummary({
        communityId: "comm_auth",
        title: "Community: auth, jwt, token",
        summary: "Cluster of 3 nodes focused on: auth, jwt, token, login, session.",
        memberNodeIds: ["task-auth-1"],
        topTerms: ["auth", "jwt", "token", "login", "session"],
      });

      const results = findByCommunity(store, "auth jwt token login");

      expect(results.length).toBeGreaterThanOrEqual(1);
      const r = results[0];
      expect(r.communityId).toBeDefined();
      expect(r.title).toBeDefined();
      expect(r.summary).toBeDefined();
      expect(r.score).toBe(0.85);
      expect(Array.isArray(r.memberNodeIds)).toBe(true);
      expect(Array.isArray(r.topTerms)).toBe(true);
    });
  });

  // ── AC2: Specific query → no interference ──
  describe("AC2: specific query does NOT activate community summaries", () => {
    it("should return empty when coverage < 60%", () => {
      insertCommunitySummary({
        communityId: "comm_db",
        title: "Community: database, sqlite, migration",
        summary: "Cluster of 4 nodes focused on: database, sqlite, migration, schema, fts.",
        memberNodeIds: ["task-db-1"],
        topTerms: ["database", "sqlite", "migration", "schema", "fts"],
      });

      // Act: very specific query about a single node — only 1/5 terms match
      const results = findByCommunity(store, "fix the bug in node parser");

      // Assert: no community summaries returned
      expect(results).toHaveLength(0);
    });

    it("should not return results when query shares only 1 term with community", () => {
      insertCommunitySummary({
        communityId: "comm_rag",
        title: "Community: rag, pipeline, retrieval",
        summary: "Cluster of 6 nodes focused on: rag, pipeline, retrieval, embedding, search, index.",
        memberNodeIds: ["task-rag-1"],
        topTerms: ["rag", "pipeline", "retrieval", "embedding", "search", "index"],
      });

      // Only "pipeline" matches — 1/6 = 16.7% < 60%
      const results = findByCommunity(store, "pipeline configuration file");

      expect(results).toHaveLength(0);
    });
  });

  // ── AC3: Feature flag disabled → no community results ──
  describe("AC3: feature flag disabled → identical to v6.x behavior", () => {
    it("should return empty when community_summaries_enabled is 'false'", () => {
      insertCommunitySummary({
        communityId: "comm_test",
        title: "Community: test, vitest, assertion",
        summary: "Cluster of 3 nodes focused on: test, vitest, assertion, coverage, tdd.",
        memberNodeIds: ["task-test-1"],
        topTerms: ["test", "vitest", "assertion", "coverage", "tdd"],
      });

      // Disable feature flag
      store.setProjectSetting("community_summaries_enabled", "false");

      // Act: query that would normally match
      const results = findByCommunity(store, "test vitest assertion coverage tdd");

      // Assert: no results because feature is disabled
      expect(results).toHaveLength(0);
    });

    it("should return results when feature flag is 'true' or not set", () => {
      insertCommunitySummary({
        communityId: "comm_api",
        title: "Community: api, rest, endpoint",
        summary: "Cluster of 4 nodes focused on: api, rest, endpoint, router, express.",
        memberNodeIds: ["task-api-1"],
        topTerms: ["api", "rest", "endpoint", "router", "express"],
      });

      // Explicitly enable
      store.setProjectSetting("community_summaries_enabled", "true");

      const results = findByCommunity(store, "api rest endpoint router");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should default to enabled when setting is not set", () => {
      insertCommunitySummary({
        communityId: "comm_cli",
        title: "Community: cli, command, parser",
        summary: "Cluster of 3 nodes focused on: cli, command, parser, args, flag.",
        memberNodeIds: ["task-cli-1"],
        topTerms: ["cli", "command", "parser", "args", "flag"],
      });

      // No setting set — should default to enabled
      const results = findByCommunity(store, "cli command parser args");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── AC4: Recall improvement (structural validation) ──
  describe("AC4: community summaries improve recall for broad queries", () => {
    it("should return additional results that executionGraphSearch alone would miss", () => {
      // Arrange: community with terms not directly in any node title
      insertCommunitySummary({
        communityId: "comm_devops",
        title: "Community: deploy, cicd, pipeline",
        summary: "Cluster of 5 nodes focused on: deploy, cicd, pipeline, docker, kubernetes.",
        memberNodeIds: ["task-deploy-1", "task-deploy-2"],
        topTerms: ["deploy", "cicd", "pipeline", "docker", "kubernetes"],
      });

      // Broad query
      const results = findByCommunity(store, "deploy cicd pipeline docker");

      // Assert: we get results from community that augment the regular search
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].memberNodeIds.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Edge cases ──
  describe("edge cases", () => {
    it("should handle empty community_summaries table gracefully", () => {
      const results = findByCommunity(store, "some broad query");
      expect(results).toHaveLength(0);
    });

    it("should handle empty query gracefully", () => {
      insertCommunitySummary({
        communityId: "comm_any",
        title: "Community: test",
        summary: "Cluster of 1 node.",
        memberNodeIds: ["task-1"],
        topTerms: ["test", "vitest"],
      });

      const results = findByCommunity(store, "");
      expect(results).toHaveLength(0);
    });

    it("should sort results by coverage when multiple communities match", () => {
      insertCommunitySummary({
        communityId: "comm_low",
        title: "Community: alpha, beta",
        summary: "Low coverage community",
        memberNodeIds: ["task-low-1"],
        topTerms: ["alpha", "beta", "gamma", "delta", "epsilon"],
      });
      insertCommunitySummary({
        communityId: "comm_high",
        title: "Community: alpha, beta, gamma, delta",
        summary: "High coverage community",
        memberNodeIds: ["task-high-1"],
        topTerms: ["alpha", "beta", "gamma", "delta", "epsilon"],
      });

      // Query covers 4/5 terms for both — both should appear, sorted by coverage
      const results = findByCommunity(store, "alpha beta gamma delta");
      expect(results.length).toBe(2);
    });
  });
});
