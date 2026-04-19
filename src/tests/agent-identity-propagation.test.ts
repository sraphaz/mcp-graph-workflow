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
 * TDD — Agent Identity Propagation (Task 2.1.3)
 *
 * Tests that agentId flows from MCP tool extra context through
 * to SqliteStore mutations (modified_by + changelog).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { extractAgentId } from "../mcp/agent-identity.js";
import type { NodeStatus, Priority } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<{ id: string; title: string; status: NodeStatus; priority: Priority }> = {}) {
  return {
    id: overrides.id ?? "node_test_001",
    type: "task" as const,
    title: overrides.title ?? "Test task",
    status: (overrides.status ?? "backlog") as NodeStatus,
    priority: (overrides.priority ?? 3) as Priority,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Agent Identity Propagation", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("test-project");
  });

  // ── AC1: insertNode records modified_by ──────────────────
  it("should record modified_by when insertNode is called with agentId", () => {
    store.insertNode(makeNode(), { agentId: "claude-session-abc" });

    const db = store.getDb();
    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = ?").get("node_test_001") as { modified_by: string | null };
    expect(row.modified_by).toBe("claude-session-abc");
  });

  // ── AC2: updateNodeStatus records agentId in changelog ───
  it("should record agentId in changelog when updateNodeStatus is called with options", () => {
    store.insertNode(makeNode({ id: "node_test_002" }));

    store.updateNodeStatus("node_test_002", "in_progress" as NodeStatus, { agentId: "agent-xyz" });

    const db = store.getDb();
    const changelog = db.prepare(
      "SELECT agent_id FROM node_changelog WHERE node_id = ? AND field = 'status'",
    ).get("node_test_002") as { agent_id: string | null } | undefined;
    expect(changelog).toBeDefined();
    expect(changelog!.agent_id).toBe("agent-xyz");
  });

  // ── AC2: updateNodeStatus updates modified_by on node ────
  it("should update modified_by when updateNodeStatus is called with agentId", () => {
    store.insertNode(makeNode({ id: "node_test_003" }));

    store.updateNodeStatus("node_test_003", "in_progress" as NodeStatus, { agentId: "agent-abc" });

    const db = store.getDb();
    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = ?").get("node_test_003") as { modified_by: string | null };
    expect(row.modified_by).toBe("agent-abc");
  });

  // ── AC3: fallback to "unknown" ───────────────────────────
  it("should use 'unknown' as agentId fallback when extra has no identity", () => {
    expect(extractAgentId({})).toBe("unknown");
  });

  it("should use 'unknown' when extra is undefined", () => {
    expect(extractAgentId(undefined)).toBe("unknown");
  });

  // ── Integration: extractAgentId → store ──────────────────
  it("should propagate extracted agentId to store operations", () => {
    const extra = { meta: { agentId: "claude-opus-session" } };
    const agentId = extractAgentId(extra);

    store.insertNode(makeNode({ id: "node_test_004" }), { agentId });

    const db = store.getDb();
    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = ?").get("node_test_004") as { modified_by: string | null };
    expect(row.modified_by).toBe("claude-opus-session");
  });

  // ── getNodeHistory should return agentId ─────────────────
  it("should include agentId in getNodeHistory results", () => {
    store.insertNode(makeNode({ id: "node_test_005" }));

    store.updateNode("node_test_005", { title: "Updated title" }, { agentId: "history-agent" });

    const history = store.getNodeHistory("node_test_005");
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty("agentId");
    expect(history[0].agentId).toBe("history-agent");
  });
});
