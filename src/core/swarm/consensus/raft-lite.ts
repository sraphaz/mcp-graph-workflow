/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-1.T09 — Raft-lite consensus.
 *
 * Minimal Raft-flavored leader election + log replication for in-process
 * agent swarms. NOT a full Raft implementation — no persistence, no
 * snapshots, no log compaction, no cluster membership change. Targets the
 * 3 acceptance criteria:
 *
 *   1. Leader election completes in < 100ms (single round of votes)
 *   2. Log replication round-trip < 50ms (single Promise.all hop)
 *   3. Leader failure triggers re-election (timer-driven)
 *
 * Caller is responsible for the network layer; this module provides the
 * pure decision logic (term updates, vote counting, log append).
 */

import { McpGraphError } from "../../utils/errors.js";
import { majorityThreshold } from "./majority.js";

export type RaftRole = "follower" | "candidate" | "leader";

export interface RaftPeer {
  id: string;
}

export interface RaftLogEntry<T = unknown> {
  term: number;
  index: number;
  value: T;
}

export interface RaftNodeState<T = unknown> {
  id: string;
  role: RaftRole;
  currentTerm: number;
  votedFor: string | null;
  log: RaftLogEntry<T>[];
  leaderId: string | null;
}

/** makeFollower — auto-generated description placeholder. */
export function makeFollower<T = unknown>(id: string): RaftNodeState<T> {
  return { id, role: "follower", currentTerm: 0, votedFor: null, log: [], leaderId: null };
}

export interface VoteRequest {
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface VoteResponse {
  term: number;
  voteGranted: boolean;
}

/**
 * Pure decision: should `node` grant its vote to `req.candidateId`?
 * Mutates the node's currentTerm and votedFor accordingly.
 */
export function handleVoteRequest<T>(
  node: RaftNodeState<T>,
  req: VoteRequest,
): VoteResponse {
  if (req.term < node.currentTerm) {
    return { term: node.currentTerm, voteGranted: false };
  }
  if (req.term > node.currentTerm) {
    node.currentTerm = req.term;
    node.role = "follower";
    node.votedFor = null;
    node.leaderId = null;
  }
  const lastIndex = node.log.length - 1;
  const lastTerm = lastIndex >= 0 ? (node.log[lastIndex]?.term ?? 0) : 0;
  const logOk = req.lastLogTerm > lastTerm || (req.lastLogTerm === lastTerm && req.lastLogIndex >= lastIndex);
  const canVote = node.votedFor === null || node.votedFor === req.candidateId;
  const grant = logOk && canVote;
  if (grant) {
    node.votedFor = req.candidateId;
  }
  return { term: node.currentTerm, voteGranted: grant };
}

export interface ElectionResult {
  elected: boolean;
  term: number;
  leaderId: string | null;
  votes: number;
  quorum: number;
}

/**
 * Run a single election round. The candidate broadcasts vote requests to
 * its peers (including itself by convention) and tallies the result.
 * Pure orchestration — caller injects the per-peer responder.
 */
export async function runElection<T>(
  candidate: RaftNodeState<T>,
  peers: RaftPeer[],
  ask: (peer: RaftPeer, req: VoteRequest) => Promise<VoteResponse>,
): Promise<ElectionResult> {
  if (peers.length === 0) {
    throw new McpGraphError("runElection requires at least one peer (self counts)");
  }
  candidate.currentTerm += 1;
  candidate.role = "candidate";
  candidate.votedFor = candidate.id;

  const lastIndex = candidate.log.length - 1;
  const lastTerm = lastIndex >= 0 ? (candidate.log[lastIndex]?.term ?? 0) : 0;
  const req: VoteRequest = {
    term: candidate.currentTerm,
    candidateId: candidate.id,
    lastLogIndex: lastIndex,
    lastLogTerm: lastTerm,
  };

  const responses = await Promise.all(peers.map((p) => ask(p, req)));
  const granted = responses.filter((r) => r.voteGranted).length;
  const quorum = majorityThreshold(peers.length);
  const elected = granted >= quorum;

  if (elected) {
    candidate.role = "leader";
    candidate.leaderId = candidate.id;
  } else {
    candidate.role = "follower";
    candidate.votedFor = null;
  }

  return {
    elected,
    term: candidate.currentTerm,
    leaderId: elected ? candidate.id : null,
    votes: granted,
    quorum,
  };
}

export interface AppendEntriesRequest<T> {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: RaftLogEntry<T>[];
}

export interface AppendEntriesResponse {
  term: number;
  success: boolean;
}

/** Pure decision: append the leader's entries (or reject) on this follower. */
export function handleAppendEntries<T>(
  follower: RaftNodeState<T>,
  req: AppendEntriesRequest<T>,
): AppendEntriesResponse {
  if (req.term < follower.currentTerm) {
    return { term: follower.currentTerm, success: false };
  }
  follower.currentTerm = req.term;
  follower.role = "follower";
  follower.leaderId = req.leaderId;

  if (req.prevLogIndex >= 0) {
    const prev = follower.log[req.prevLogIndex];
    if (!prev || prev.term !== req.prevLogTerm) {
      return { term: follower.currentTerm, success: false };
    }
  }
  // Truncate any conflicting tail and append.
  follower.log = follower.log.slice(0, req.prevLogIndex + 1);
  follower.log.push(...req.entries);
  return { term: follower.currentTerm, success: true };
}

export interface HeartbeatTimer {
  /** Timestamp (ms) of the last heartbeat received from the leader. */
  lastHeartbeatMs: number;
  /** Timeout after which a follower considers the leader dead. */
  electionTimeoutMs: number;
}

/** shouldStartElection — auto-generated description placeholder. */
export function shouldStartElection(now: number, t: HeartbeatTimer): boolean {
  return now - t.lastHeartbeatMs >= t.electionTimeoutMs;
}
