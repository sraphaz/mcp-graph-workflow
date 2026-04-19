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
import { GraphEventBus } from "../core/events/event-bus.js";
import { makeNode } from "./helpers/factories.js";

describe("insertNode transaction safety (E1-T10)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── AC1: insertNode wrapped in transaction ──

  describe("atomicity", () => {
    it("should not leave partial state if insert fails (duplicate ID)", () => {
      const node = makeNode();
      store.insertNode(node);

      // Second insert with same ID should fail atomically
      expect(() => store.insertNode(node)).toThrow();

      // Only 1 node should exist
      expect(store.getAllNodes()).toHaveLength(1);
    });

    it("should successfully insert a valid node", () => {
      const node = makeNode({ title: "Transaction test", tags: ["t1"], metadata: { key: "val" } });
      store.insertNode(node);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe("Transaction test");
      expect(retrieved!.tags).toEqual(["t1"]);
      expect(retrieved!.metadata).toEqual({ key: "val" });
    });
  });

  // ── AC2: event emitted after transaction succeeds ──

  describe("event ordering", () => {
    it("should not emit event if transaction fails", () => {
      const events: string[] = [];
      const bus = new GraphEventBus();
      bus.on("node:created", () => events.push("created"));
      store.eventBus = bus;

      const node = makeNode();
      store.insertNode(node);
      expect(events).toContain("created");

      // Reset events
      events.length = 0;

      // Duplicate insert should fail — no event emitted
      expect(() => store.insertNode(node)).toThrow();
      expect(events).not.toContain("created");
    });
  });

  // ── AC3: FTS index consistent with base table after insert ──

  describe("FTS consistency", () => {
    it("should find inserted node via FTS search", () => {
      const node = makeNode({ title: "Quantum Computing Framework", description: "A novel approach to quantum gates" });
      store.insertNode(node);

      // FTS search should find the node (content-based FTS uses rowid, query returns title/description)
      const db = (store as unknown as { db: { prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] } } }).db;
      const results = db.prepare(
        "SELECT title FROM nodes_fts WHERE nodes_fts MATCH ?",
      ).all("quantum") as { title: string }[];

      expect(results.length).toBeGreaterThan(0);
    });

    it("should have matching row counts between base table and FTS", () => {
      store.insertNode(makeNode({ title: "Alpha" }));
      store.insertNode(makeNode({ title: "Beta" }));
      store.insertNode(makeNode({ title: "Gamma" }));

      const db = (store as unknown as { db: { prepare: (sql: string) => { get: () => { cnt: number } } } }).db;

      const baseCount = db.prepare("SELECT COUNT(*) as cnt FROM nodes").get().cnt;
      const ftsCount = db.prepare("SELECT COUNT(*) as cnt FROM nodes_fts").get().cnt;

      expect(baseCount).toBe(3);
      expect(ftsCount).toBe(3);
    });
  });
});
