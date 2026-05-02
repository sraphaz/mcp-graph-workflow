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
 * Auto-sequence: creates depends_on edges between children of a parent node,
 * ordered by createdAt, so each child depends on the previous one.
 */
import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphEdge } from "./graph-types.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

/** sequenceSubtasks — auto-generated description placeholder. */
export function sequenceSubtasks(store: SqliteStore, parentId: string): { edgesCreated: number; chain: string[] } {
  const doc = store.toGraphDocument();
  const children = doc.nodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (children.length < 2) return { edgesCreated: 0, chain: children.map(c => c.id) };

  const edges: GraphEdge[] = [];
  for (let i = 1; i < children.length; i++) {
    const edge: GraphEdge = {
      id: generateId("edge"),
      from: children[i].id,
      to: children[i - 1].id,
      relationType: "depends_on",
      reason: "Auto-sequenced by parent",
      createdAt: now(),
    };
    edges.push(edge);
  }

  if (edges.length > 0) {
    store.mergeInsert([], edges);
  }

  logger.info("auto-sequence", { parentId, edgesCreated: edges.length });
  return { edgesCreated: edges.length, chain: children.map(c => c.id) };
}
