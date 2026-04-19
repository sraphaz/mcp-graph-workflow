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

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphNode } from "../core/graph/graph-types.js";

describe("Agent context in SqliteStore mutations", () => {
  let store: SqliteStore;

  const makeNode = (id: string, title: string): GraphNode => ({
    id,
    type: "task",
    title,
    status: "backlog",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  it("insertNode with agentId sets modified_by", () => {
    store.insertNode(makeNode("n1", "Task A"), { agentId: "agent-alpha" });
    const db = store.getDb();
    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = ?").get("n1") as { modified_by: string | null };
    expect(row.modified_by).toBe("agent-alpha");
  });

  it("insertNode without agentId leaves modified_by null", () => {
    store.insertNode(makeNode("n2", "Task B"));
    const db = store.getDb();
    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = ?").get("n2") as { modified_by: string | null };
    expect(row.modified_by).toBeNull();
  });

  it("updateNode with agentId sets modified_by and increments version", () => {
    store.insertNode(makeNode("n3", "Task C"));
    store.updateNode("n3", { title: "Task C Updated" }, { agentId: "agent-beta" });

    const db = store.getDb();
    const row = db.prepare("SELECT modified_by, version FROM nodes WHERE id = ?").get("n3") as {
      modified_by: string | null;
      version: number;
    };
    expect(row.modified_by).toBe("agent-beta");
    expect(row.version).toBe(2);
  });

  it("updateNode without agentId preserves modified_by from insert", () => {
    store.insertNode(makeNode("n4", "Task D"), { agentId: "agent-gamma" });
    store.updateNode("n4", { title: "Task D Updated" });

    const db = store.getDb();
    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = ?").get("n4") as { modified_by: string | null };
    // modified_by should still be agent-gamma since updateNode without agentId does not overwrite it
    expect(row.modified_by).toBe("agent-gamma");
  });

  it("changelog records agent_id", () => {
    store.insertNode(makeNode("n5", "Task E"));
    store.updateNode("n5", { title: "Task E v2" }, { agentId: "agent-delta" });

    const db = store.getDb();
    const rows = db.prepare(
      "SELECT agent_id FROM node_changelog WHERE node_id = ?",
    ).all("n5") as Array<{ agent_id: string | null }>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].agent_id).toBe("agent-delta");
  });

  it("changelog has null agent_id when no options provided", () => {
    store.insertNode(makeNode("n6", "Task F"));
    store.updateNode("n6", { title: "Task F v2" });

    const db = store.getDb();
    const rows = db.prepare(
      "SELECT agent_id FROM node_changelog WHERE node_id = ?",
    ).all("n6") as Array<{ agent_id: string | null }>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].agent_id).toBeNull();
  });
});
