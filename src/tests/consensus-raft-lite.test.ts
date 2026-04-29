/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-1.T09 — Raft-lite consensus tests.
 */

import { describe, it, expect } from "vitest";
import {
  makeFollower,
  runElection,
  handleVoteRequest,
  handleAppendEntries,
  shouldStartElection,
  type RaftNodeState,
  type VoteRequest,
} from "../core/swarm/consensus/raft-lite.js";

describe("raft-lite consensus (E1.T09)", () => {
  it("leader election completes in <100ms with simple grant-all peers", async () => {
    const candidate = makeFollower<string>("c1");
    const peers = [{ id: "c1" }, { id: "p2" }, { id: "p3" }];
    const ask = async (_p: { id: string }, req: VoteRequest) => ({ term: req.term, voteGranted: true });

    const t0 = performance.now();
    const r = await runElection(candidate, peers, ask);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(100);
    expect(r.elected).toBe(true);
    expect(r.leaderId).toBe("c1");
    expect(r.votes).toBe(3);
    expect(r.quorum).toBe(2);
    expect(candidate.role).toBe("leader");
  });

  it("election fails when quorum is not reached", async () => {
    const candidate = makeFollower<string>("c1");
    const peers = [{ id: "c1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }, { id: "p5" }];
    const ask = async (p: { id: string }, req: VoteRequest) => ({
      term: req.term,
      voteGranted: p.id === "c1", // only self-vote
    });
    const r = await runElection(candidate, peers, ask);
    expect(r.elected).toBe(false);
    expect(candidate.role).toBe("follower");
  });

  it("log replication round-trip <50ms (in-process append)", async () => {
    const follower = makeFollower<number>("f1");
    follower.currentTerm = 1;
    const t0 = performance.now();
    const resp = handleAppendEntries(follower, {
      term: 1,
      leaderId: "leader",
      prevLogIndex: -1,
      prevLogTerm: 0,
      entries: [
        { term: 1, index: 0, value: 42 },
        { term: 1, index: 1, value: 43 },
      ],
    });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(50);
    expect(resp.success).toBe(true);
    expect(follower.log).toHaveLength(2);
    expect(follower.leaderId).toBe("leader");
  });

  it("rejects append when follower's term is higher than leader's", () => {
    const follower = makeFollower<number>("f1");
    follower.currentTerm = 5;
    const resp = handleAppendEntries(follower, {
      term: 3,
      leaderId: "leader",
      prevLogIndex: -1,
      prevLogTerm: 0,
      entries: [],
    });
    expect(resp.success).toBe(false);
    expect(resp.term).toBe(5);
  });

  it("rejects append when prev-log-term mismatch", () => {
    const follower = makeFollower<number>("f1");
    follower.currentTerm = 2;
    follower.log = [{ term: 1, index: 0, value: 100 }];
    const resp = handleAppendEntries(follower, {
      term: 2,
      leaderId: "leader",
      prevLogIndex: 0,
      prevLogTerm: 5, // mismatch
      entries: [{ term: 2, index: 1, value: 200 }],
    });
    expect(resp.success).toBe(false);
    expect(follower.log).toHaveLength(1); // unchanged
  });

  it("vote rejected when candidate term is older", () => {
    const node = makeFollower<string>("n1");
    node.currentTerm = 5;
    const resp = handleVoteRequest(node, {
      term: 3,
      candidateId: "c",
      lastLogIndex: -1,
      lastLogTerm: 0,
    });
    expect(resp.voteGranted).toBe(false);
  });

  it("vote granted only once per term (votedFor sticky)", () => {
    const node = makeFollower<string>("n1");
    const a = handleVoteRequest(node, { term: 1, candidateId: "ca", lastLogIndex: -1, lastLogTerm: 0 });
    const b = handleVoteRequest(node, { term: 1, candidateId: "cb", lastLogIndex: -1, lastLogTerm: 0 });
    expect(a.voteGranted).toBe(true);
    expect(b.voteGranted).toBe(false);
  });

  it("leader failure (heartbeat timeout) triggers re-election eligibility", () => {
    const now = 1_000_000;
    const lastHeartbeatMs = now - 200;
    expect(
      shouldStartElection(now, { lastHeartbeatMs, electionTimeoutMs: 150 }),
    ).toBe(true);
    expect(
      shouldStartElection(now, { lastHeartbeatMs, electionTimeoutMs: 500 }),
    ).toBe(false);
  });

  it("re-election after leader failure: stale leader's term overridden", () => {
    const candidate: RaftNodeState<string> = makeFollower("new");
    candidate.currentTerm = 4;
    // Simulate election after leader timeout
    return runElection(candidate, [{ id: "new" }, { id: "p2" }], async (_p, req) => ({
      term: req.term,
      voteGranted: true,
    })).then((r) => {
      expect(r.elected).toBe(true);
      expect(r.term).toBe(5); // bumped from 4
      expect(candidate.role).toBe("leader");
    });
  });
});
