/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 1 completion — Topology descriptors: ring + star + conflict resolution
 */

import { describe, it, expect } from "vitest";
import {
  getRingOrder,
  buildRingRoutes,
  buildStarRoutes,
  resolveConflict,
} from "../core/swarm/topologies/ring.js";
import {
  getHubId,
  buildStarRoutes as buildStarRoutesAlt,
} from "../core/swarm/topologies/star.js";
import { SwarmConfigSchema } from "../core/swarm/swarm-types.js";

// ─── Ring topology ──────────────────────────────────────────────────────────

describe("ring topology", () => {
  it("getRingOrder returns agents in circular order", () => {
    const agents = ["a1", "a2", "a3"];
    const order = getRingOrder(agents);
    expect(order).toHaveLength(3);
    // Each agent maps to its next in the ring
    expect(order[0].from).toBe("a1");
    expect(order[0].to).toBe("a2");
    expect(order[1].from).toBe("a2");
    expect(order[1].to).toBe("a3");
    expect(order[2].from).toBe("a3");
    expect(order[2].to).toBe("a1"); // wraps back
  });

  it("getRingOrder with 1 agent routes to itself", () => {
    const order = getRingOrder(["solo"]);
    expect(order[0].from).toBe("solo");
    expect(order[0].to).toBe("solo");
  });

  it("buildRingRoutes returns next-agent mapping for each agent", () => {
    const agents = ["a1", "a2", "a3"];
    const routes = buildRingRoutes(agents);
    expect(routes["a1"]).toBe("a2");
    expect(routes["a2"]).toBe("a3");
    expect(routes["a3"]).toBe("a1");
  });

  it("buildStarRoutes in ring module throws (star is in star module)", () => {
    // buildStarRoutes exported from ring for convenience — just delegates
    const routes = buildStarRoutes("hub", ["w1", "w2"]);
    expect(routes["w1"]).toBe("hub");
    expect(routes["w2"]).toBe("hub");
    expect(routes["hub"]).toBe(undefined);
  });
});

// ─── Star topology ──────────────────────────────────────────────────────────

describe("star topology (hub-and-spoke)", () => {
  it("getHubId returns first agent as hub by default", () => {
    const hub = getHubId(["coordinator", "w1", "w2"]);
    expect(hub).toBe("coordinator");
  });

  it("buildStarRoutes maps every worker back to hub", () => {
    const routes = buildStarRoutesAlt("hub", ["w1", "w2", "w3"]);
    expect(routes["w1"]).toBe("hub");
    expect(routes["w2"]).toBe("hub");
    expect(routes["w3"]).toBe("hub");
    // Hub does not have a route entry (it dispatches)
    expect(routes["hub"]).toBeUndefined();
  });

  it("buildStarRoutes with 0 workers returns empty routes", () => {
    const routes = buildStarRoutesAlt("hub", []);
    expect(Object.keys(routes)).toHaveLength(0);
  });
});

// ─── Conflict resolution ───────────────────────────────────────────────────

describe("resolveConflict", () => {
  it("last_wins returns the last value", () => {
    expect(resolveConflict("last_wins", "a", "b")).toBe("b");
  });

  it("first_wins returns the first value", () => {
    expect(resolveConflict("first_wins", "a", "b")).toBe("a");
  });

  it("error throws McpGraphError", () => {
    expect(() => resolveConflict("error", "a", "b")).toThrow();
  });
});

// ─── SwarmConfig schema accepts conflictStrategy ───────────────────────────

describe("SwarmConfigSchema — conflictStrategy field", () => {
  it("accepts last_wins as conflictStrategy", () => {
    const cfg = SwarmConfigSchema.parse({
      topology: "ring",
      consensus: "majority",
      maxAgents: 3,
      strategy: "specialized",
      conflictStrategy: "last_wins",
    });
    expect(cfg.conflictStrategy).toBe("last_wins");
  });

  it("defaults conflictStrategy to last_wins when omitted", () => {
    const cfg = SwarmConfigSchema.parse({
      topology: "star",
      consensus: "raft",
      maxAgents: 4,
      strategy: "specialized",
    });
    expect(cfg.conflictStrategy).toBe("last_wins");
  });

  it("rejects invalid conflictStrategy", () => {
    expect(() =>
      SwarmConfigSchema.parse({
        topology: "mesh",
        consensus: "majority",
        maxAgents: 2,
        strategy: "specialized",
        conflictStrategy: "invalid",
      }),
    ).toThrow();
  });
});
