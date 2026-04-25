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
 * Deadlock Detector — cycle detection in the agent wait-for graph.
 *
 * Models the multi-agent lock graph as a directed graph where an edge
 * (A → B) means "agent A is waiting for a resource held by agent B".
 * Detects cycles using DFS. When a cycle is found, resolves it by aborting
 * the agent with the most-recent lock acquisition (newest claim loses).
 *
 * Recurrent deadlocks on the same resource are tracked; ≥3 events within
 * 1 hour triggers an escalation flag for the dashboard.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface LockEdge {
  /** Agent waiting to acquire the resource */
  readonly agentId: string;
  /** The resource being waited on */
  readonly resourceId: string;
  /** Agent currently holding the resource */
  readonly holderId: string;
  /** ISO timestamp when holderId acquired the resource */
  readonly acquiredAt: string;
}

export interface DeadlockResult {
  readonly hasDeadlock: boolean;
  /** Agents forming the cycle, in traversal order. Empty when no deadlock. */
  readonly cycle: readonly string[];
}

export interface DeadlockResolution {
  /** Agent whose claim is aborted. Null when no deadlock. */
  readonly abortedAgent: string | null;
  /** Resource released by the aborted agent. */
  readonly releasedResource: string;
  /** True when the abort is clean (state not corrupted). */
  readonly cleanAbort: boolean;
  /** Other cycle members who continue unaffected after the abort. */
  readonly survivingAgents: string[];
}

export interface DeadlockEvent {
  readonly resourceId: string;
  readonly detectedAt: string;
}

const ESCALATION_THRESHOLD = 3;
const ESCALATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect cycles in the wait-for graph built from the given edges.
 * Returns the first cycle found, or an empty cycle when the graph is acyclic.
 */
export function detectDeadlock(edges: LockEdge[]): DeadlockResult {
  // Build adjacency: agentId → holderId (the agent it's waiting on)
  const waitFor = new Map<string, string>();
  for (const e of edges) {
    waitFor.set(e.agentId, e.holderId);
  }

  const globalVisited = new Set<string>();

  for (const start of waitFor.keys()) {
    if (globalVisited.has(start)) continue;
    const cycle = findCycleFromStart(start, waitFor, globalVisited);
    if (cycle.length > 0) {
      return { hasDeadlock: true, cycle };
    }
  }

  return { hasDeadlock: false, cycle: [] };
}

/**
 * Resolve a detected deadlock by aborting the agent with the most-recent
 * lock acquisition in the cycle.
 */
export function resolveDeadlock(detection: DeadlockResult, edges: LockEdge[]): DeadlockResolution {
  if (!detection.hasDeadlock || detection.cycle.length === 0) {
    return { abortedAgent: null, releasedResource: "", cleanAbort: true, survivingAgents: [] };
  }

  // Among agents in the cycle, find the one whose wait-for edge was created most recently
  const cycleSet = new Set(detection.cycle);
  const cycleEdges = edges.filter((e) => cycleSet.has(e.agentId));

  let newestEdge: LockEdge | undefined;
  for (const e of cycleEdges) {
    if (!newestEdge || e.acquiredAt > newestEdge.acquiredAt) {
      newestEdge = e;
    }
  }

  // The aborted agent is the newest waiter in the cycle (most recently started waiting)
  const abortedAgent = newestEdge?.agentId ?? detection.cycle[0];
  // The released resource is what the aborted agent was trying to claim
  const releasedResource = newestEdge?.resourceId ?? "";
  // Deduplicate cycle members before computing survivors
  const uniqueCycleMembers = [...new Set(detection.cycle)];
  const survivingAgents = uniqueCycleMembers.filter((a) => a !== abortedAgent);

  return { abortedAgent, releasedResource, cleanAbort: true, survivingAgents };
}

/**
 * Record a deadlock detection event for a specific resource.
 * Appends to the mutable events array (caller manages persistence).
 */
export function recordDeadlockEvent(events: DeadlockEvent[], resourceId: string): void {
  events.push({ resourceId, detectedAt: new Date().toISOString() });
}

/**
 * Return true when a resource has been involved in ≥3 deadlocks within the
 * last hour — the escalation threshold for dashboard alerts.
 */
export function shouldEscalate(resourceId: string, events: DeadlockEvent[]): boolean {
  const now = Date.now();
  const windowStart = now - ESCALATION_WINDOW_MS;
  const recentCount = events.filter(
    (e) =>
      e.resourceId === resourceId && new Date(e.detectedAt).getTime() >= windowStart,
  ).length;
  return recentCount >= ESCALATION_THRESHOLD;
}

// ── Cycle detection via path following ────────────────────────────────────

/**
 * Follow the wait-for chain from `start`, recording the path.
 * If we revisit a node already in the current path, we found a cycle.
 * Marks all visited nodes in globalVisited to avoid re-traversal.
 */
function findCycleFromStart(
  start: string,
  waitFor: Map<string, string>,
  globalVisited: Set<string>,
): string[] {
  const path: string[] = [];
  const posInPath = new Map<string, number>(); // node → index in path

  let current: string | undefined = start;

  while (current !== undefined) {
    if (globalVisited.has(current)) {
      // Already fully explored — no new cycle through this node
      break;
    }
    const cycleStart = posInPath.get(current);
    if (cycleStart !== undefined) {
      // current is already in the current path → cycle found
      const cycle = path.slice(cycleStart);
      // Mark all nodes in the path as globally visited
      for (const n of path) globalVisited.add(n);
      return cycle;
    }
    posInPath.set(current, path.length);
    path.push(current);
    current = waitFor.get(current);
  }

  // No cycle — mark all as visited
  for (const n of path) globalVisited.add(n);
  return [];
}
