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

import { describe, it, expect, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

describe("Migration v30 — schema cleanup", () => {
  let store: SqliteStore;

  afterEach(() => {
    store?.close();
  });

  it("should complete migration v30 successfully", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    // Check migration v30 was applied
    const db = (store as unknown as { db: Database.Database }).db;
    const applied = db.prepare("SELECT version FROM _migrations WHERE version = 30").get();
    expect(applied).toBeDefined();
  });

  it("should run migration in under 5 seconds on empty DB", () => {
    const start = Date.now();
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  it("should have FTS index working after migration", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    // Insert a node with searchable content
    const node = makeNode({
      title: "Findable unique keyword zxcvbn",
      description: "This node should be searchable via FTS",
    });
    store.insertNode(node);

    // Search should find the node via FTS
    const results = store.searchNodes("zxcvbn");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(node.id);
  });

  it("should ensure blocked field defaults to false for new nodes", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    const node = makeNode({ title: "Node without blocked" });
    store.insertNode(node);

    const fetched = store.getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.blocked).toBe(false);
  });

  it("should ensure status and priority are always set", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    const node = makeNode({ title: "Node with defaults" });
    store.insertNode(node);

    const fetched = store.getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.status).toBe("backlog");
    expect(fetched!.priority).toBe(3);
  });
});
