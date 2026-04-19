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
 * Shared test factories for creating minimal valid graph objects.
 * Eliminates duplication across 18+ test files.
 */
import type { GraphNode, GraphEdge } from "../../core/graph/graph-types.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

export function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  const timestamp = now();
  return {
    id: generateId("node"),
    type: "task",
    title: "Test task",
    status: "backlog",
    priority: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function makeEdge(from: string, to: string, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: generateId("edge"),
    from,
    to,
    relationType: "depends_on",
    createdAt: now(),
    ...overrides,
  };
}

export function makeEpic(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "epic", title: "Test epic", priority: 2, ...overrides });
}

export function makeTask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "task", title: "Test task", priority: 3, ...overrides });
}

export function makeSubtask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "subtask", title: "Test subtask", priority: 3, ...overrides });
}

export function makeDoneTask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "task", title: "Done task", status: "done", ...overrides });
}

export function makeBlockedTask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "task", title: "Blocked task", blocked: true, ...overrides });
}
