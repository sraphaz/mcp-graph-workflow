/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies.
 * Majority consensus — simple majority (floor(N/2)+1) over discrete votes.
 * Used to consolidate DoD check decisions from a swarm of N workers.
 */

import { McpGraphError } from "../../utils/errors.js";

export interface Vote<T> {
  agentId: string;
  value: T;
}

export interface ConsensusResult<T> {
  reached: boolean;
  winner: T | null;
  support: number;
  threshold: number;
  total: number;
  /** Per-value tally for diagnostics. */
  tally: Record<string, number>;
}

/** majorityThreshold — auto-generated description placeholder. */
export function majorityThreshold(n: number): number {
  if (n <= 0) {
    throw new McpGraphError(`majorityThreshold requires n > 0, got ${n}`);
  }
  return Math.floor(n / 2) + 1;
}

/** tallyVotes — auto-generated description placeholder. */
export function tallyVotes<T>(votes: Vote<T>[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const vVar of votes) {
    counts.set(vVar.value, (counts.get(vVar.value) ?? 0) + 1);
  }
  return counts;
}

/** computeMajorityConsensus — auto-generated description placeholder. */
export function computeMajorityConsensus<T>(votes: Vote<T>[]): ConsensusResult<T> {
  if (votes.length === 0) {
    throw new McpGraphError("computeMajorityConsensus requires at least one vote");
  }
  const seen = new Set<string>();
  for (const vVar of votes) {
    if (seen.has(vVar.agentId)) {
      throw new McpGraphError(`Duplicate vote from agent: ${vVar.agentId}`);
    }
    seen.add(vVar.agentId);
  }

  const counts = tallyVotes(votes);
  const threshold = majorityThreshold(votes.length);

  let winner: T | null = null;
  let support = 0;
  for (const [value, count] of counts.entries()) {
    if (count >= threshold && count > support) {
      winner = value;
      support = count;
    }
  }

  const tally: Record<string, number> = {};
  for (const [value, count] of counts.entries()) {
    tally[String(value)] = count;
  }

  return {
    reached: winner !== null,
    winner,
    support,
    threshold,
    total: votes.length,
    tally,
  };
}
