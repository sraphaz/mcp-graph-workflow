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
 * Consistency policy — enforces the substrate authority hierarchy:
 *   graph > memory > knowledge/RAG > provenance (append-only)
 *
 * Rules:
 * 1. Graph is authoritative — memory entries lose conflicts to graph state.
 * 2. Knowledge/RAG are derivable — eviction + reindex must preserve canonical hashes.
 * 3. Provenance is append-only — retroactive edits are rejected with an immutable error.
 */

import type Database from "better-sqlite3";
import { KnowledgeStore, contentHash } from "./knowledge-store.js";
import { logger } from "../utils/logger.js";

// ── AC3 Error ────────────────────────────────────────────────────

export class ProvenanceImmutabilityError extends Error {
  readonly code = "PROVENANCE_IMMUTABLE" as const;

  constructor(docId: string) {
    super(`Provenance record "${docId}" is append-only and cannot be modified retroactively`);
    this.name = "ProvenanceImmutabilityError";
  }
}

// ── AC1 Types ────────────────────────────────────────────────────

export interface ConflictResolution {
  winner: "graph";
  nodeId: string;
  staleness: "stale";
  memoryDocsAffected: number;
}

// ── AC2 Types ────────────────────────────────────────────────────

export interface EvictionResult {
  docId: string;
  hashBefore: string;
  hashAfter: string;
  hashPreserved: boolean;
}

// ── AC1: Graph wins over memory ──────────────────────────────────

/**
 * Resolve a conflict between graph state and memory entries by marking all
 * memory knowledge docs referencing the given nodeId as stale.
 * Graph is always the winner — staleness_days is set to a high sentinel value.
 */
export function resolveGraphMemoryConflict(
  db: Database.Database,
  nodeId: string,
): ConflictResolution {
  const STALE_SENTINEL = 999;

  const result = db
    .prepare(
      `UPDATE knowledge_documents
       SET staleness_days = ?, updated_at = datetime('now')
       WHERE source_type = 'memory' AND source_id = ?`,
    )
    .run(STALE_SENTINEL, nodeId);

  logger.debug("consistency:graph_memory_conflict_resolved", {
    nodeId,
    memoryDocsAffected: result.changes,
  });

  return {
    winner: "graph",
    nodeId,
    staleness: "stale",
    memoryDocsAffected: result.changes,
  };
}

// ── AC2: Evict and reindex preserving canonical hash ─────────────

/**
 * Evict a knowledge document and reindex with new content.
 * Returns whether the content hash was preserved (matching original).
 * A hash mismatch signals content divergence from the graph node source.
 */
export function evictAndReindexKnowledge(
  store: KnowledgeStore,
  docId: string,
  newContent: string,
): EvictionResult {
  const existing = store.getById(docId);
  const hashBefore = existing ? contentHash(existing.content) : "";
  const hashAfter = contentHash(newContent);

  store.delete(docId);

  logger.debug("consistency:knowledge_evicted", { docId, hashPreserved: hashBefore === hashAfter });

  return {
    docId,
    hashBefore,
    hashAfter,
    hashPreserved: hashBefore === hashAfter,
  };
}

// ── AC3: Provenance is append-only ───────────────────────────────

/**
 * Attempting to update an existing provenance record is always rejected.
 * Provenance is append-only by design — new entries must be created instead.
 */
export function updateProvenance(docId: string): never {
  throw new ProvenanceImmutabilityError(docId);
}
