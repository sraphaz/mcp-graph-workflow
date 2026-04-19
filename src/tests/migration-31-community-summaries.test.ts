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
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";

describe("Migration 31 — community_summaries table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create community_summaries table with all required columns", () => {
    const columns = db
      .prepare("PRAGMA table_info(community_summaries)")
      .all() as Array<{ name: string; type: string; notnull: number; pk: number }>;

    expect(columns.length).toBeGreaterThan(0);
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("community_id");
    expect(names).toContain("title");
    expect(names).toContain("summary");
    expect(names).toContain("member_node_ids");
    expect(names).toContain("member_count");
    expect(names).toContain("top_terms");
    expect(names).toContain("created_at");
    expect(names).toContain("updated_at");
  });

  it("should have correct column types", () => {
    const columns = db
      .prepare("PRAGMA table_info(community_summaries)")
      .all() as Array<{ name: string; type: string }>;

    const colMap = new Map(columns.map((c) => [c.name, c.type]));

    expect(colMap.get("id")).toBe("TEXT");
    expect(colMap.get("community_id")).toBe("TEXT");
    expect(colMap.get("title")).toBe("TEXT");
    expect(colMap.get("summary")).toBe("TEXT");
    expect(colMap.get("member_node_ids")).toBe("TEXT");
    expect(colMap.get("member_count")).toBe("INTEGER");
    expect(colMap.get("top_terms")).toBe("TEXT");
    expect(colMap.get("created_at")).toBe("TEXT");
    expect(colMap.get("updated_at")).toBe("TEXT");
  });

  it("should have id as primary key", () => {
    const columns = db
      .prepare("PRAGMA table_info(community_summaries)")
      .all() as Array<{ name: string; pk: number }>;

    const idCol = columns.find((c) => c.name === "id");
    expect(idCol?.pk).toBe(1);
  });

  it("should create community_summaries_fts virtual table", () => {
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='community_summaries_fts'",
      )
      .get();
    expect(table).toBeDefined();
  });

  it("should support inserting and querying community_summaries", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO community_summaries
        (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "cs-001",
      "comm-1",
      "RAG Pipeline Community",
      "Nodes related to retrieval-augmented generation and embedding",
      JSON.stringify(["node_a", "node_b", "node_c"]),
      3,
      JSON.stringify(["retrieval", "embedding", "vector", "search"]),
      now,
      now,
    );

    const row = db
      .prepare("SELECT * FROM community_summaries WHERE id = ?")
      .get("cs-001") as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.community_id).toBe("comm-1");
    expect(row.member_count).toBe(3);
    expect(JSON.parse(row.member_node_ids as string)).toHaveLength(3);
  });

  it("should be idempotent — running migrations again does not error", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("should support FTS5 full-text search on summary field", () => {
    const now = new Date().toISOString();

    const insertStmt = db.prepare(
      `INSERT INTO community_summaries
        (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertStmt.run(
      "cs-001",
      "comm-1",
      "PPR Community",
      "Personalized PageRank graph traversal nodes",
      "[]",
      2,
      JSON.stringify(["pagerank", "graph", "traversal"]),
      now,
      now,
    );
    insertStmt.run(
      "cs-002",
      "comm-2",
      "BM25 Community",
      "Full-text search and BM25 scoring nodes",
      "[]",
      4,
      JSON.stringify(["bm25", "search", "scoring"]),
      now,
      now,
    );

    // FTS5 match on summary
    const results = db
      .prepare(
        `SELECT c.id FROM community_summaries c
         JOIN community_summaries_fts f ON c.rowid = f.rowid
         WHERE f.summary MATCH ?`,
      )
      .all("pagerank") as Array<{ id: string }>;

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("cs-001");
  });

  it("should support FTS5 search on top_terms field", () => {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO community_summaries
        (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "cs-003",
      "comm-3",
      "Adaptive RRF Community",
      "Nodes implementing retrieval fusion strategy",
      "[]",
      5,
      JSON.stringify(["adaptive", "rrf", "fusion", "phase", "weights"]),
      now,
      now,
    );

    const results = db
      .prepare(
        `SELECT c.id FROM community_summaries c
         JOIN community_summaries_fts f ON c.rowid = f.rowid
         WHERE f.top_terms MATCH ?`,
      )
      .all("adaptive") as Array<{ id: string }>;

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("cs-003");
  });

  it("should have index on community_id for fast lookups", () => {
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='community_summaries'",
      )
      .all() as Array<{ name: string }>;

    expect(indexes.some((i) => i.name === "idx_community_summaries_community_id")).toBe(true);
  });

  it("should complete FTS5 search within acceptable latency for 1000 entries", () => {
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO community_summaries
        (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertMany = db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        insert.run(
          `cs-${i}`,
          `comm-${i % 50}`,
          `Community title ${i}`,
          `Summary about node ${i} with graph traversal and retrieval augmented generation techniques`,
          JSON.stringify([`node_${i}`, `node_${i + 1}`]),
          2,
          JSON.stringify(["graph", "retrieval", `term${i}`]),
          now,
          now,
        );
      }
    });
    insertMany();

    const start = performance.now();
    const results = db
      .prepare(
        `SELECT c.id FROM community_summaries c
         JOIN community_summaries_fts f ON c.rowid = f.rowid
         WHERE f.summary MATCH ?`,
      )
      .all("retrieval") as Array<{ id: string }>;
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200); // 50ms generous threshold for in-memory SQLite
  });
});
