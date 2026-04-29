/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T04).
 * Tests for majority consensus.
 */

import { describe, it, expect } from "vitest";
import {
  majorityThreshold,
  tallyVotes,
  computeMajorityConsensus,
  type Vote,
} from "../core/swarm/consensus/majority.js";

describe("majority consensus (E19.T04)", () => {
  it("majorityThreshold(N) = floor(N/2)+1 (simple majority)", () => {
    expect(majorityThreshold(1)).toBe(1);
    expect(majorityThreshold(2)).toBe(2);
    expect(majorityThreshold(3)).toBe(2);
    expect(majorityThreshold(4)).toBe(3);
    expect(majorityThreshold(5)).toBe(3);
    expect(majorityThreshold(7)).toBe(4);
  });

  it("majorityThreshold throws when N <= 0", () => {
    expect(() => majorityThreshold(0)).toThrow();
    expect(() => majorityThreshold(-1)).toThrow();
  });

  it("tallyVotes counts occurrences per value", () => {
    const tally = tallyVotes<string>([
      { agentId: "a", value: "pass" },
      { agentId: "b", value: "pass" },
      { agentId: "c", value: "fail" },
    ]);
    expect(tally.get("pass")).toBe(2);
    expect(tally.get("fail")).toBe(1);
  });

  it("computeMajorityConsensus picks winner when count >= threshold", () => {
    const votes: Vote<"pass" | "fail">[] = [
      { agentId: "a", value: "pass" },
      { agentId: "b", value: "pass" },
      { agentId: "c", value: "fail" },
    ];
    const result = computeMajorityConsensus(votes);
    expect(result.reached).toBe(true);
    expect(result.winner).toBe("pass");
    expect(result.support).toBe(2);
    expect(result.threshold).toBe(2);
    expect(result.total).toBe(3);
  });

  it("computeMajorityConsensus returns reached=false on tie (4 votes / 2-2)", () => {
    const votes: Vote<string>[] = [
      { agentId: "a", value: "pass" },
      { agentId: "b", value: "pass" },
      { agentId: "c", value: "fail" },
      { agentId: "d", value: "fail" },
    ];
    const result = computeMajorityConsensus(votes);
    expect(result.reached).toBe(false);
    expect(result.winner).toBeNull();
    expect(result.threshold).toBe(3);
  });

  it("computeMajorityConsensus on 3-way split (3 votes / 1-1-1) — no majority", () => {
    const votes: Vote<string>[] = [
      { agentId: "a", value: "x" },
      { agentId: "b", value: "y" },
      { agentId: "c", value: "z" },
    ];
    const result = computeMajorityConsensus(votes);
    expect(result.reached).toBe(false);
    expect(result.winner).toBeNull();
  });

  it("computeMajorityConsensus rejects empty votes", () => {
    expect(() => computeMajorityConsensus([])).toThrow();
  });

  it("computeMajorityConsensus with single voter — winner if N=1, threshold=1", () => {
    const result = computeMajorityConsensus([{ agentId: "a", value: "pass" }]);
    expect(result.reached).toBe(true);
    expect(result.winner).toBe("pass");
    expect(result.threshold).toBe(1);
  });

  it("computeMajorityConsensus rejects duplicate agentId votes", () => {
    expect(() =>
      computeMajorityConsensus([
        { agentId: "a", value: "pass" },
        { agentId: "a", value: "fail" },
      ]),
    ).toThrow();
  });

  it("perValue tally exposed in result for diagnostics", () => {
    const result = computeMajorityConsensus([
      { agentId: "a", value: "pass" },
      { agentId: "b", value: "pass" },
      { agentId: "c", value: "pass" },
      { agentId: "d", value: "fail" },
    ]);
    expect(result.tally).toEqual({ pass: 3, fail: 1 });
  });
});
