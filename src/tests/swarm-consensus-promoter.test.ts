/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T14 — swarm consensus promoter tests.
 */

import { describe, it, expect } from "vitest";
import {
  computeMajorityConsensus,
  isSwarmAutoPromoteDisabled,
  CONSENSUS_MAJORITY_RATIO,
} from "../core/hooks/swarm-consensus-promoter.js";

describe("swarm-consensus-promoter (E21.T14)", () => {
  it("CONSENSUS_MAJORITY_RATIO = 0.5", () => {
    expect(CONSENSUS_MAJORITY_RATIO).toBe(0.5);
  });

  it("returns reached=false on empty votes", () => {
    const r = computeMajorityConsensus({ sessionId: "s", nodeId: "n", votes: {} });
    expect(r.reached).toBe(false);
    expect(r.winner).toBeNull();
    expect(r.payload).toBeNull();
  });

  it("returns reached=true when winner > 50%", () => {
    const r = computeMajorityConsensus({
      sessionId: "s1",
      nodeId: "n1",
      votes: { yes: 4, no: 1 },
    });
    expect(r.reached).toBe(true);
    expect(r.winner).toBe("yes");
    expect(r.support).toBe(4);
    expect(r.total).toBe(5);
    expect(r.payload).toEqual({
      sessionId: "s1",
      nodeId: "n1",
      consensus: { winner: "yes", support: 4, total: 5 },
    });
  });

  it("returns reached=false on tie 50/50 (strict majority)", () => {
    const r = computeMajorityConsensus({
      sessionId: "s",
      nodeId: "n",
      votes: { a: 2, b: 2 },
    });
    expect(r.reached).toBe(false);
    expect(r.payload).toBeNull();
  });

  it("returns reached=false when no option exceeds threshold (3-way split)", () => {
    const r = computeMajorityConsensus({
      sessionId: "s",
      nodeId: "n",
      votes: { a: 2, b: 2, c: 1 },
    });
    expect(r.reached).toBe(false);
  });

  it("supports custom majorityRatio", () => {
    const r = computeMajorityConsensus({
      sessionId: "s",
      nodeId: "n",
      votes: { a: 6, b: 4 },
      majorityRatio: 0.55,
    });
    expect(r.reached).toBe(true);
    expect(r.winner).toBe("a");
  });

  it("breaks ties deterministically by lexicographic key (no consensus though)", () => {
    const r = computeMajorityConsensus({
      sessionId: "s",
      nodeId: "n",
      votes: { z: 3, a: 3, m: 1 },
    });
    // total=7, top=3, 3/7=0.43 → not reached, but support reflects highest sorted
    expect(r.reached).toBe(false);
    expect(r.support).toBe(3);
  });

  it("isSwarmAutoPromoteDisabled respects env", () => {
    expect(isSwarmAutoPromoteDisabled({ MCP_GRAPH_SWARM_AUTO_PROMOTE: "off" })).toBe(true);
    expect(isSwarmAutoPromoteDisabled({})).toBe(false);
  });
});
