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
 * Tests for community summaries integration in Graph RAG.
 *
 * AC1: Broad query → community summary in top-3
 * AC2: Narrow query → no community summaries injected (coverage < 60%)
 * AC3: Feature flag off → v6.x behavior (tested via executionGraphSearch options)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { findByCommunity } from "../core/rag/graph-rag-strategy.js";

function seedCommunitySummaries(store: SqliteStore): void {
  const db = store.getDb();
  const now = new Date().toISOString();

  // Auth community
  db.prepare("INSERT INTO community_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "cs-1", "comm_auth",
    "Community: auth, login, oauth",
    "Authentication cluster with OAuth, session management, and token handling",
    JSON.stringify(["n1", "n2", "n3", "n4", "n5"]),
    5,
    JSON.stringify(["auth", "login", "oauth", "session", "token"]),
    now, now,
  );

  // RAG community
  db.prepare("INSERT INTO community_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "cs-2", "comm_rag",
    "Community: rag, search, pipeline",
    "RAG pipeline with search, embeddings, and retrieval ranking",
    JSON.stringify(["n6", "n7", "n8"]),
    3,
    JSON.stringify(["rag", "search", "pipeline", "embedding", "retrieval"]),
    now, now,
  );

  // Sprint community
  db.prepare("INSERT INTO community_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "cs-3", "comm_sprint",
    "Community: sprint, velocity, planning",
    "Sprint planning with velocity tracking and backlog management",
    JSON.stringify(["n9", "n10", "n11", "n12"]),
    4,
    JSON.stringify(["sprint", "velocity", "planning", "backlog", "task"]),
    now, now,
  );
}

describe("findByCommunity", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("community-rag-test");
    seedCommunitySummaries(store);
  });

  afterEach(() => {
    store.close();
  });

  // AC1: Broad query matches community summary
  it("should return matching community for broad query with high term coverage", () => {
    const results = findByCommunity(store, "auth login oauth session token management");

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].communityId).toBe("comm_auth");
    expect(results[0].score).toBe(0.85);
  });

  // AC1: Sprint query matches sprint community
  it("should match sprint community for sprint-related broad query", () => {
    const results = findByCommunity(store, "sprint velocity planning backlog progress");

    expect(results.length).toBeGreaterThanOrEqual(1);
    const sprintMatch = results.find((r) => r.communityId === "comm_sprint");
    expect(sprintMatch).toBeDefined();
    expect(sprintMatch!.score).toBe(0.85);
  });

  // AC2: Narrow query → no match (low coverage)
  it("should NOT match for narrow query with low term coverage", () => {
    const results = findByCommunity(store, "how does FTS5 tokenizer work internally");

    expect(results.length).toBe(0);
  });

  // AC2: Single-word queries rarely match
  it("should NOT match for very specific single-topic query", () => {
    const results = findByCommunity(store, "BM25 algorithm k1 parameter");

    expect(results.length).toBe(0);
  });

  // Edge: empty query
  it("should return empty for empty query", () => {
    const results = findByCommunity(store, "");

    expect(results.length).toBe(0);
  });

  // Edge: no community summaries in DB
  it("should return empty when no community summaries exist", () => {
    const emptyStore = SqliteStore.open(":memory:");
    emptyStore.initProject("empty-test");

    const results = findByCommunity(emptyStore, "auth login oauth");
    expect(results.length).toBe(0);

    emptyStore.close();
  });

  // Results have correct CommunitySearchResult structure
  it("should return results with valid CommunitySearchResult fields", () => {
    const results = findByCommunity(store, "rag search pipeline embedding retrieval");

    expect(results.length).toBeGreaterThanOrEqual(1);
    const r = results[0];
    expect(r.communityId).toBeDefined();
    expect(r.title).toBeDefined();
    expect(r.summary).toBeDefined();
    expect(r.score).toBe(0.85);
    expect(r.coverage).toBeGreaterThanOrEqual(0.6);
    expect(Array.isArray(r.memberNodeIds)).toBe(true);
    expect(Array.isArray(r.topTerms)).toBe(true);
  });
});
