/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  TopologySchema,
  ConsensusKindSchema,
  AgentRoleSchema,
  SwarmConfigSchema,
  type Topology,
  type ConsensusKind,
  type AgentRole,
  type SwarmConfig,
} from "../core/swarm/swarm-types.js";

describe("TopologySchema", () => {
  it("accepts valid topologies", () => {
    const valid: Topology[] = ["hierarchical", "mesh", "ring", "star"];
    for (const t of valid) {
      expect(TopologySchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects invalid topology string", () => {
    expect(TopologySchema.safeParse("byzantine").success).toBe(false);
    expect(TopologySchema.safeParse("").success).toBe(false);
    expect(TopologySchema.safeParse(42).success).toBe(false);
  });
});

describe("ConsensusKindSchema", () => {
  it("accepts raft and majority", () => {
    const valid: ConsensusKind[] = ["raft", "majority"];
    for (const c of valid) {
      expect(ConsensusKindSchema.safeParse(c).success).toBe(true);
    }
  });

  it("rejects unknown consensus kind", () => {
    expect(ConsensusKindSchema.safeParse("gossip").success).toBe(false);
    expect(ConsensusKindSchema.safeParse("byzantine").success).toBe(false);
  });
});

describe("AgentRoleSchema", () => {
  it("accepts queen, worker, coordinator, observer", () => {
    const valid: AgentRole[] = ["queen", "worker", "coordinator", "observer"];
    for (const r of valid) {
      expect(AgentRoleSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("SwarmConfigSchema", () => {
  const valid: SwarmConfig = {
    topology: "hierarchical",
    consensus: "raft",
    maxAgents: 4,
    strategy: "specialized",
  };

  it("accepts a valid config", () => {
    expect(SwarmConfigSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects maxAgents <= 0", () => {
    expect(SwarmConfigSchema.safeParse({ ...valid, maxAgents: 0 }).success).toBe(false);
    expect(SwarmConfigSchema.safeParse({ ...valid, maxAgents: -1 }).success).toBe(false);
  });

  it("rejects maxAgents > 32 (ceiling)", () => {
    expect(SwarmConfigSchema.safeParse({ ...valid, maxAgents: 33 }).success).toBe(false);
  });

  it("strategy defaults to 'specialized' when omitted", () => {
    const result = SwarmConfigSchema.safeParse({ topology: "mesh", consensus: "majority", maxAgents: 2 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strategy).toBe("specialized");
    }
  });

  it("z.infer exports correct TypeScript types at runtime", () => {
    const cfg: SwarmConfig = { topology: "star", consensus: "majority", maxAgents: 8, strategy: "specialized" };
    expect(cfg.maxAgents).toBe(8);
    const topo: Topology = "ring";
    const kind: ConsensusKind = "raft";
    const role: AgentRole = "worker";
    expect(topo).toBe("ring");
    expect(kind).toBe("raft");
    expect(role).toBe("worker");
  });
});
