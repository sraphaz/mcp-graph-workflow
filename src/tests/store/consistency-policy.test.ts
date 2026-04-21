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
 * Task 4.2: Politica de consistencia e eviction — node_ac7a44e47fc6
 *
 * AC1: graph vs memory conflict → graph wins, memory marked stale.
 * AC2: knowledge eviction → reindex preserves canonical hash.
 * AC3: retroactive provenance edit → rejected with immutable error.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import {
  resolveGraphMemoryConflict,
  evictAndReindexKnowledge,
  updateProvenance,
  ProvenanceImmutabilityError,
} from "../../core/store/consistency-policy.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  // Minimal knowledge_documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      chunk_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_accessed_at TEXT,
      metadata TEXT DEFAULT '{}',
      quality_score REAL DEFAULT 0.5,
      staleness_days REAL DEFAULT 0,
      recency_score REAL DEFAULT 0.5,
      usage_count INTEGER DEFAULT 0
    )
  `);
  return db;
}

// ── AC1: graph vs memory ─────────────────────────────────────────
describe("resolveGraphMemoryConflict — AC1", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = createDb();
    store = new KnowledgeStore(db);
    // Insert a memory doc referencing node_123
    store.insert({
      title: "Memory: task_123",
      content: "Old cached content for node_123",
      sourceType: "memory",
      sourceId: "node_123",
      metadata: { nodeId: "node_123" },
    });
  });

  it("should return graph as winner", () => {
    const result = resolveGraphMemoryConflict(db, "node_123");
    expect(result.winner).toBe("graph");
  });

  it("should mark memory docs referencing the conflicting node as stale", () => {
    resolveGraphMemoryConflict(db, "node_123");
    const affected = db
      .prepare("SELECT staleness_days FROM knowledge_documents WHERE source_type = 'memory' AND source_id = ?")
      .all("node_123") as Array<{ staleness_days: number }>;
    expect(affected.length).toBeGreaterThan(0);
    expect(affected[0].staleness_days).toBeGreaterThan(0);
  });

  it("should report the number of affected memory docs", () => {
    const result = resolveGraphMemoryConflict(db, "node_123");
    expect(result.memoryDocsAffected).toBe(1);
  });

  it("should not affect non-memory docs for the same node", () => {
    store.insert({
      title: "Knowledge: task_123",
      content: "Graph-derived knowledge for node_123",
      sourceType: "graph_node",
      sourceId: "node_123",
    });
    resolveGraphMemoryConflict(db, "node_123");
    const nodeDocs = db
      .prepare("SELECT staleness_days FROM knowledge_documents WHERE source_type = 'graph_node' AND source_id = ?")
      .all("node_123") as Array<{ staleness_days: number }>;
    expect(nodeDocs[0].staleness_days).toBe(0);
  });
});

// ── AC2: eviction + reindex preserves hash ────────────────────────
describe("evictAndReindexKnowledge — AC2", () => {
  let db: Database.Database;
  let store: KnowledgeStore;

  beforeEach(() => {
    db = createDb();
    store = new KnowledgeStore(db);
  });

  it("should delete the original document", () => {
    const doc = store.insert({
      title: "Knowledge doc",
      content: "original content",
      sourceType: "graph_node",
      sourceId: "node_abc",
    });
    evictAndReindexKnowledge(store, doc.id, "original content");
    const found = db.prepare("SELECT id FROM knowledge_documents WHERE id = ?").get(doc.id);
    expect(found).toBeUndefined();
  });

  it("should reinsert with the same content hash (hash preserved)", () => {
    const doc = store.insert({
      title: "Knowledge doc",
      content: "original content",
      sourceType: "graph_node",
      sourceId: "node_abc",
    });
    const result = evictAndReindexKnowledge(store, doc.id, "original content");
    expect(result.hashPreserved).toBe(true);
    expect(result.hashBefore).toBe(result.hashAfter);
  });

  it("should detect hash mismatch when content diverges", () => {
    const doc = store.insert({
      title: "Knowledge doc",
      content: "original content",
      sourceType: "graph_node",
      sourceId: "node_abc",
    });
    const result = evictAndReindexKnowledge(store, doc.id, "different content");
    expect(result.hashPreserved).toBe(false);
    expect(result.hashBefore).not.toBe(result.hashAfter);
  });
});

// ── AC3: provenance immutability ──────────────────────────────────
describe("updateProvenance — AC3", () => {
  it("should throw ProvenanceImmutabilityError when called", () => {
    expect(() => updateProvenance("doc_123")).toThrow(ProvenanceImmutabilityError);
  });

  it("should throw with a message mentioning the docId", () => {
    expect(() => updateProvenance("prov_xyz")).toThrow(/prov_xyz/);
  });

  it("ProvenanceImmutabilityError should have code PROVENANCE_IMMUTABLE", () => {
    try {
      updateProvenance("any");
    } catch (err) {
      expect(err).toBeInstanceOf(ProvenanceImmutabilityError);
      expect((err as ProvenanceImmutabilityError).code).toBe("PROVENANCE_IMMUTABLE");
    }
  });
});
