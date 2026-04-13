/**
 * Tests for community summary integration in Graph RAG.
 *
 * Task 2.3 (node_69c6715807f9) — Epic: Community Detection e Community Summaries
 *
 * AC1: Broad query returns community summary in top-3
 * AC2: Specific query does NOT trigger community path (coverage < 60%)
 * AC3: Feature flag disabled = no community summaries injected
 */

import { describe, it, expect } from "vitest";
import { findByCommunity } from "../core/rag/graph-rag-strategy.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

function seedCommunitySummaries(store: SqliteStore): void {
  const db = store.getDb();
  const now = new Date().toISOString();

  db.prepare("DELETE FROM community_summaries").run();

  const insert = db.prepare(`
    INSERT INTO community_summaries (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    "cs_sprint_1", "comm_sprint",
    "Community: sprint, planning, velocity",
    "Cluster of 8 nodes focused on: sprint, planning, velocity, backlog, iteration, burndown, tasks, progress.",
    JSON.stringify(["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"]),
    8,
    JSON.stringify(["sprint", "planning", "velocity", "backlog", "iteration", "burndown", "tasks", "progress"]),
    now, now,
  );

  insert.run(
    "cs_auth_1", "comm_auth",
    "Community: authentication, session, token",
    "Cluster of 5 nodes focused on: authentication, session, token, middleware, security, login, jwt, authorization.",
    JSON.stringify(["a1", "a2", "a3", "a4", "a5"]),
    5,
    JSON.stringify(["authentication", "session", "token", "middleware", "security", "login", "jwt", "authorization"]),
    now, now,
  );
}

describe("graph-rag community integration", () => {
  // ── AC1: Broad query hits community summary ──
  describe("findByCommunity — broad queries", () => {
    it("should return community summary when query has high coverage (>= 60%)", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-community-rag");
      seedCommunitySummaries(store);

      // 5 of 8 top_terms matched = 62.5% coverage → triggers
      const results = findByCommunity(store, "sprint planning velocity progress burndown");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBe(0.85);
      expect(results[0].title).toContain("sprint");

      store.close();
    });

    it("should return community summary in results for broad sprint query with many terms", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-community-rag");
      seedCommunitySummaries(store);

      // 5 of 8 top_terms = 62.5% coverage → triggers community path
      const results = findByCommunity(store, "sprint planning velocity backlog iteration status");

      const sprintResult = results.find((r) => r.title.includes("sprint"));
      expect(sprintResult).toBeDefined();

      store.close();
    });
  });

  // ── AC2: Specific query does NOT trigger ──
  describe("findByCommunity — specific queries", () => {
    it("should return empty when query is very specific (coverage < 60%)", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-community-rag");
      seedCommunitySummaries(store);

      const results = findByCommunity(store, "node_abc123 specific bug fix");
      expect(results).toHaveLength(0);

      store.close();
    });

    it("should not match when only 1 term overlaps with community", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-community-rag");
      seedCommunitySummaries(store);

      // Only "sprint" overlaps — 1/8 = 12.5% < 60%
      const results = findByCommunity(store, "sprint");
      expect(results).toHaveLength(0);

      store.close();
    });
  });

  // ── Empty table ──
  describe("findByCommunity — empty table", () => {
    it("should return empty when no community summaries exist", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-empty");

      const results = findByCommunity(store, "sprint planning velocity");
      expect(results).toEqual([]);

      store.close();
    });
  });

  // ── Result structure ──
  describe("findByCommunity — result structure", () => {
    it("should return results with correct CommunitySearchResult shape", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-structure");
      seedCommunitySummaries(store);

      const results = findByCommunity(store, "authentication session token security login");

      expect(results.length).toBeGreaterThanOrEqual(1);
      const result = results[0];
      expect(result.communityId).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.score).toBe(0.85);
      expect(result.coverage).toBeGreaterThanOrEqual(0.6);
      expect(Array.isArray(result.memberNodeIds)).toBe(true);
      expect(Array.isArray(result.topTerms)).toBe(true);

      store.close();
    });
  });
});
