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
import { buildKanbanBoard } from "../core/kanban/kanban-builder.js";
import { generateSuggestions } from "../core/kanban/kanban-orchestrator.js";
import { DEFAULT_KANBAN_CONFIG } from "../core/kanban/kanban-types.js";
import type { KanbanConfig } from "../core/kanban/kanban-types.js";
import { makeNode, makeEdge, makeDoneTask } from "./helpers/factories.js";

describe("generateSuggestions", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Kanban Orchestrator Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should suggest promoting backlog tasks when all deps are resolved", () => {
    const dep = makeDoneTask({ title: "Dependency" });
    const task = makeNode({ title: "Ready to promote", status: "backlog" });
    store.insertNode(dep);
    store.insertNode(task);
    store.insertEdge(makeEdge(task.id, dep.id));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);
    const suggestions = generateSuggestions(doc, board);

    const promote = suggestions.find((s) => s.nodeId === task.id && s.action === "promote_ready");
    expect(promote).toBeDefined();
    expect(promote!.reason).toContain("dependencies resolved");
  });

  it("should suggest unblocking tasks when blockers are done", () => {
    const blocker = makeDoneTask({ title: "Was blocking" });
    const task = makeNode({ title: "Was blocked", status: "blocked" });
    store.insertNode(blocker);
    store.insertNode(task);
    store.insertEdge(makeEdge(task.id, blocker.id));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);
    const suggestions = generateSuggestions(doc, board);

    const unblock = suggestions.find((s) => s.nodeId === task.id && s.action === "unblock");
    expect(unblock).toBeDefined();
    expect(unblock!.reason).toContain("blockers resolved");
  });

  it("should warn on WIP violations", () => {
    store.insertNode(makeNode({ title: "WIP 1", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 2", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 3", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 4", status: "in_progress" }));

    const doc = store.toGraphDocument();
    const config: KanbanConfig = {
      ...DEFAULT_KANBAN_CONFIG,
      wipLimits: { ...DEFAULT_KANBAN_CONFIG.wipLimits, in_progress: 3 },
    };
    const board = buildKanbanBoard(doc, config);
    const suggestions = generateSuggestions(doc, board);

    const wipWarn = suggestions.find((s) => s.action === "wip_violation");
    expect(wipWarn).toBeDefined();
    expect(wipWarn!.reason).toContain("WIP limit");
  });

  it("should surface next task suggestion", () => {
    store.insertNode(makeNode({ title: "Next up", status: "backlog", priority: 1 }));
    store.insertNode(makeNode({ title: "Later", status: "backlog", priority: 5 }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);
    const suggestions = generateSuggestions(doc, board);

    const nextSuggestion = suggestions.find((s) => s.action === "start_next");
    expect(nextSuggestion).toBeDefined();
    expect(nextSuggestion!.nodeTitle).toBe("Next up");
  });

  it("should return empty suggestions when graph is healthy", () => {
    store.insertNode(makeDoneTask({ title: "All done" }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);
    const suggestions = generateSuggestions(doc, board);

    expect(suggestions).toHaveLength(0);
  });

  it("should detect bottleneck accumulation in blocked column", () => {
    store.insertNode(makeNode({ title: "Blocked 1", status: "blocked" }));
    store.insertNode(makeNode({ title: "Blocked 2", status: "blocked" }));
    store.insertNode(makeNode({ title: "Blocked 3", status: "blocked" }));
    store.insertNode(makeNode({ title: "Backlog 1", status: "backlog" }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);
    const suggestions = generateSuggestions(doc, board);

    const bottleneck = suggestions.find((s) => s.action === "bottleneck_alert");
    expect(bottleneck).toBeDefined();
    expect(bottleneck!.reason).toContain("blocked");
  });
});
