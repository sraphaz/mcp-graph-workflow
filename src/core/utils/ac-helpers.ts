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
 * AC (Acceptance Criteria) helpers — centralized utility for gathering AC
 * from both inline fields and child acceptance_criteria nodes.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";

/**
 * Get all AC texts for a node — prefers inline AC, falls back to child AC node titles.
 */
// Bug #096: cache index for O(1) lookups when called in loops
let _cachedDocRef: WeakRef<GraphDocument> | null = null;
let _nodeMap: Map<string, GraphDocument["nodes"][number]> = new Map();
let _acByParent: Map<string, string[]> = new Map();

function ensureAcIndex(doc: GraphDocument): void {
  if (_cachedDocRef?.deref() === doc) return;
  _cachedDocRef = new WeakRef(doc);
  _nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  _acByParent = new Map();
  for (const n of doc.nodes) {
    if (n.type === "acceptance_criteria" && n.parentId) {
      const list = _acByParent.get(n.parentId) ?? [];
      list.push(n.title);
      _acByParent.set(n.parentId, list);
    }
  }
}

/** Retrieve acceptance criteria texts for a node, falling back to parent AC nodes. */
export function getNodeAcTexts(doc: GraphDocument, nodeId: string): string[] {
  ensureAcIndex(doc);
  const node = _nodeMap.get(nodeId);
  if (!node) return [];

  const inline = node.acceptanceCriteria ?? [];
  if (inline.length > 0) return inline;

  return _acByParent.get(nodeId) ?? [];
}

/**
 * Get all AC texts for a node using store queries (no full graph scan).
 * Prefers inline AC, falls back to child AC node titles.
 */
export function getNodeAcFromStore(store: SqliteStore, nodeId: string): string[] {
  const node = store.getNodeById(nodeId);
  if (!node) return [];

  const inline = node.acceptanceCriteria ?? [];
  if (inline.length > 0) return inline;

  return store.getChildNodes(nodeId)
    .filter((n) => n.type === "acceptance_criteria")
    .map((n) => n.title);
}

/**
 * Check if a node has any AC — either inline or via child AC nodes.
 */
export function nodeHasAc(doc: GraphDocument, nodeId: string): boolean {
  return getNodeAcTexts(doc, nodeId).length > 0;
}
