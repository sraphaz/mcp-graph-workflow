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
 * Cache Invalidator — Dependency-Aware Cache Coherence
 *
 * Provides phase-aware TTL and dependency-graph-based invalidation
 * for the RAG semantic cache. When a node changes status,
 * all nodes that depend on it have their cached contexts invalidated.
 *
 * Based on: Cache Coherence Protocol — consistency via proactive invalidation.
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "cache-invalidator.ts" });

// ── Types ───────────────────────────────────────────────

export interface CacheTokenStats {
  hits: number;
  avgTokensPerHit: number;
  tokensSaved: number;
}

interface EdgeLike {
  from: string;
  to: string;
  relationType: string;
}

// ── Phase TTL ───────────────────────────────────────────

const PHASE_TTL_MS: Record<string, number> = {
  ANALYZE: 2 * 60 * 60 * 1000,   // 2h — requirements change slowly
  DESIGN: 2 * 60 * 60 * 1000,    // 2h — architecture is stable
  PLAN: 60 * 60 * 1000,          // 1h — sprint plans are semi-stable
  IMPLEMENT: 30 * 60 * 1000,     // 30min — code changes frequently
  VALIDATE: 30 * 60 * 1000,      // 30min — test results change
  REVIEW: 60 * 60 * 1000,        // 1h
  HANDOFF: 2 * 60 * 60 * 1000,   // 2h
  DEPLOY: 30 * 60 * 1000,        // 30min
  LISTENING: 2 * 60 * 60 * 1000, // 2h — idle phase
};

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30min

/**
 * Get the cache TTL in milliseconds for a given lifecycle phase.
 * Phases with slower change rates get longer TTLs.
 */
export function getPhaseTtlMs(phase: string): number {
  return PHASE_TTL_MS[phase] ?? DEFAULT_TTL_MS;
}

// ── Dependency Invalidation ─────────────────────────────

/**
 * Find all node IDs whose caches should be invalidated when a given node changes.
 * Returns nodes that have a `depends_on` edge pointing TO the changed node.
 *
 * Example: if A depends_on B and B changes → A's cache is invalidated.
 */
export function invalidateDependentCaches(
  changedNodeId: string,
  edges: EdgeLike[],
): string[] {
  const dependents: string[] = [];

  for (const edge of edges) {
    // A depends_on B means edge.from=A, edge.to=B
    // When B changes, A needs invalidation
    if (edge.relationType === "depends_on" && edge.to === changedNodeId) {
      dependents.push(edge.from);
    }
  }

  if (dependents.length > 0) {
    log.debug("cache-invalidator:dependents", {
      changedNode: changedNodeId,
      invalidated: dependents.length,
    });
  }

  return dependents;
}

// ── Token Stats ─────────────────────────────────────────

/**
 * Compute token savings from cache hits.
 */
export function getCacheTokenStats(
  hits: number,
  avgTokensPerHit: number,
): CacheTokenStats {
  return {
    hits,
    avgTokensPerHit,
    tokensSaved: hits * avgTokensPerHit,
  };
}
