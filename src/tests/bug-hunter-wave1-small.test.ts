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
 * Bug Hunter Wave 1 — Small fixes tests.
 * Covers: E1-T06, E1-T14, E1-T03, E1-T08, E1-T13
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore } from "./helpers/test-store.js";
import { makeNode } from "./helpers/factories.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

describe("Bug Hunter Wave 1 — Small fixes", () => {
  let store: SqliteStore;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createTestStore("wave1-test");
    store = ctx.store;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  // ── E1-T06: Composite index (project_id, parent_id) ──

  describe("E1-T06: composite index idx_nodes_project_parent", () => {
    it("should have idx_nodes_project_parent index on nodes table", () => {
      const db = store.getDb();
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'nodes'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_nodes_project_parent");
    });

    it("should index both project_id and parent_id columns", () => {
      const db = store.getDb();
      const info = db
        .prepare("PRAGMA index_info(idx_nodes_project_parent)")
        .all() as Array<{ name: string }>;

      const columnNames = info.map((col) => col.name);
      expect(columnNames).toContain("project_id");
      expect(columnNames).toContain("parent_id");
    });
  });

  // ── E1-T14: Metadata size limit for nodes ──

  describe("E1-T14: node metadata size limit", () => {
    it("should reject insertNode with metadata exceeding 100KB", () => {
      const hugeMetadata: Record<string, string> = { data: "x".repeat(150_000) };
      const node = makeNode({ metadata: hugeMetadata });

      expect(() => store.insertNode(node)).toThrow(/metadata too large/i);
    });

    it("should allow insertNode with metadata under 100KB", () => {
      const smallMetadata = { key: "value" };
      const node = makeNode({ metadata: smallMetadata });

      expect(() => store.insertNode(node)).not.toThrow();
    });

    it("should reject updateNode with metadata exceeding 100KB", () => {
      const node = makeNode();
      store.insertNode(node);

      const hugeMetadata: Record<string, string> = { data: "x".repeat(150_000) };

      expect(() =>
        store.updateNode(node.id, { metadata: hugeMetadata }),
      ).toThrow(/metadata too large/i);
    });

    it("should allow updateNode with metadata under 100KB", () => {
      const node = makeNode();
      store.insertNode(node);

      expect(() =>
        store.updateNode(node.id, { metadata: { key: "small" } }),
      ).not.toThrow();
    });
  });

  // ── E1-T03: Safety snapshot before clearImportedNodes ──

  describe("E1-T03: snapshot before clearImportedNodes", () => {
    it("should create a snapshot before deleting imported nodes", () => {
      // Insert a node with a source file to simulate an import
      const node = makeNode({
        sourceRef: { file: "test.prd.md", startLine: 1, endLine: 10, confidence: 1.0 },
      });
      store.insertNode(node);

      // Record snapshot count before
      const db = store.getDb();
      const countBefore = (
        db.prepare("SELECT COUNT(*) as cnt FROM snapshots").get() as { cnt: number }
      ).cnt;

      // Clear imported nodes
      store.clearImportedNodes("test.prd.md");

      // Verify a new snapshot was created
      const countAfter = (
        db.prepare("SELECT COUNT(*) as cnt FROM snapshots").get() as { cnt: number }
      ).cnt;
      expect(countAfter).toBe(countBefore + 1);
    });

    it("should include the deleted nodes data in the snapshot", () => {
      const node = makeNode({
        title: "Snapshot Test Node",
        sourceRef: { file: "snapshot-test.prd.md", startLine: 1, endLine: 5, confidence: 1.0 },
      });
      store.insertNode(node);

      store.clearImportedNodes("snapshot-test.prd.md");

      // The latest snapshot should contain the node
      const db = store.getDb();
      const snapshot = db
        .prepare("SELECT data FROM snapshots ORDER BY id DESC LIMIT 1")
        .get() as { data: string };

      const parsed = JSON.parse(snapshot.data) as { nodes: Array<{ title: string }> };
      const titles = parsed.nodes.map((n) => n.title);
      expect(titles).toContain("Snapshot Test Node");
    });
  });

  // ── E1-T08: Fix autoprune NULL column ordering ──

  describe("E1-T08: autoprune NULL column ordering", () => {
    it("should prune entries with NULL quality_score before those with scores", () => {
      const db = store.getDb();
      const ks = new KnowledgeStore(db);

      // Insert docs — some with NULL quality_score
      const docWithScore = ks.insert({
        sourceType: "upload",
        sourceId: "scored-doc",
        title: "Scored Doc",
        content: "Content with score",
      });
      // Manually set quality_score to a value
      db.prepare("UPDATE knowledge_documents SET quality_score = 0.9 WHERE id = ?").run(
        docWithScore.id,
      );

      const docNullScore = ks.insert({
        sourceType: "upload",
        sourceId: "null-doc",
        title: "Null Score Doc",
        content: "Content with null score",
      });
      // Manually set quality_score to NULL
      db.prepare("UPDATE knowledge_documents SET quality_score = NULL WHERE id = ?").run(
        docNullScore.id,
      );

      // Budget = 1, so 1 should be pruned. The NULL one should go first.
      const result = ks.autoprune(1, false);
      expect(result.removed).toBe(1);
      expect(result.removedIds).toContain(docNullScore.id);
      expect(result.removedIds).not.toContain(docWithScore.id);
    });

    it("should handle all-NULL quality_score without errors", () => {
      const db = store.getDb();
      const ks = new KnowledgeStore(db);

      ks.insert({ sourceType: "upload", sourceId: "a", title: "A", content: "aaa" });
      ks.insert({ sourceType: "upload", sourceId: "b", title: "B", content: "bbb" });

      // Set both to NULL
      db.prepare("UPDATE knowledge_documents SET quality_score = NULL, usage_count = NULL").run();

      // Should not throw
      const result = ks.autoprune(1, false);
      expect(result.removed).toBe(1);
    });
  });

  // ── E1-T13: Index on plugins(project_id) ──

  describe("E1-T13: plugins project_id index", () => {
    it("should have idx_plugins_project index on plugins table", () => {
      const db = store.getDb();
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'plugins'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_plugins_project");
    });
  });
});
