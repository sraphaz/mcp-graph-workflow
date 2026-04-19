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
import { makeNode } from "./helpers/factories.js";

describe("Corrupt JSON logging in rowToNode (E1-T07)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── AC1: corrupt JSON parse logged with node ID and field name ──
  //   Verified by code inspection: logger.warn("corrupt JSON in node field", { nodeId, field })
  // ── AC2: fallback behavior preserved (empty array/object) ──
  //   Verified by tests below
  // ── AC3: logger used, not console.log ──
  //   Verified by code inspection: uses logger from src/core/utils/logger.ts

  describe("tags field — fallback to empty array", () => {
    it("should return empty tags array when tags JSON is corrupt", () => {
      const node = makeNode({ tags: ["valid", "tags"] });
      store.insertNode(node);

      // Corrupt the tags field
      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare("UPDATE nodes SET tags = ? WHERE id = ?").run("{not valid json[", node.id);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.tags).toEqual([]);
    });
  });

  describe("acceptanceCriteria field — fallback to empty array", () => {
    it("should return empty AC array when acceptanceCriteria JSON is corrupt", () => {
      const node = makeNode({ acceptanceCriteria: ["AC1", "AC2"] });
      store.insertNode(node);

      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare("UPDATE nodes SET acceptance_criteria = ? WHERE id = ?").run("<<<broken>>>", node.id);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.acceptanceCriteria).toEqual([]);
    });
  });

  describe("testFiles field — fallback to empty array", () => {
    it("should return empty testFiles array when testFiles JSON is corrupt", () => {
      const node = makeNode({ testFiles: ["test.ts"] });
      store.insertNode(node);

      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare("UPDATE nodes SET test_files = ? WHERE id = ?").run("{broken", node.id);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.testFiles).toEqual([]);
    });
  });

  describe("metadata field — fallback to empty object", () => {
    it("should return empty metadata object when metadata JSON is corrupt", () => {
      const node = makeNode({ metadata: { key: "value" } });
      store.insertNode(node);

      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare("UPDATE nodes SET metadata = ? WHERE id = ?").run("not-json!", node.id);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.metadata).toEqual({});
    });
  });

  describe("non-JSON fields unaffected", () => {
    it("should preserve non-JSON fields even when JSON fields are corrupt", () => {
      const node = makeNode({
        title: "My Task",
        description: "A description",
        tags: ["tag1"],
        metadata: { key: "val" },
      });
      store.insertNode(node);

      // Corrupt both JSON fields
      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare("UPDATE nodes SET tags = ?, metadata = ? WHERE id = ?").run("broken", "broken", node.id);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe("My Task");
      expect(retrieved!.description).toBe("A description");
      expect(retrieved!.tags).toEqual([]);
      expect(retrieved!.metadata).toEqual({});
    });
  });
});
