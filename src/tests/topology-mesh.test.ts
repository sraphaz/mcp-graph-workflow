/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-1.T05 — Mesh topology tests.
 */

import { describe, it, expect } from "vitest";
import { buildMeshLayout, hasNoSpof } from "../core/swarm/topologies/mesh.js";

describe("mesh topology (E1.T05)", () => {
  it("builds an all-to-all routing table from a 3-agent fixture", () => {
    const layout = buildMeshLayout(["alice", "bob", "carol"]);
    expect(layout.agents).toEqual(["alice", "bob", "carol"]);
    expect(layout.peers["alice"]).toEqual(["bob", "carol"]);
    expect(layout.peers["bob"]).toEqual(["alice", "carol"]);
    expect(layout.peers["carol"]).toEqual(["alice", "bob"]);
    expect(layout.edgeCount).toBe(6);
  });

  it("3 agents fan out — each sees 2 peers (full mesh)", () => {
    const layout = buildMeshLayout(["a", "b", "c"]);
    for (const a of layout.agents) {
      expect(layout.peers[a]).toHaveLength(2);
      expect(layout.peers[a]).not.toContain(a);
    }
  });

  it("hasNoSpof returns true for ≥2 fully-connected agents", () => {
    const l3 = buildMeshLayout(["a", "b", "c"]);
    expect(hasNoSpof(l3)).toBe(true);
    const l2 = buildMeshLayout(["a", "b"]);
    expect(hasNoSpof(l2)).toBe(true);
  });

  it("hasNoSpof returns false for a single agent (degenerate)", () => {
    const l1 = buildMeshLayout(["solo"]);
    expect(hasNoSpof(l1)).toBe(false);
  });

  it("ordering is deterministic (alphabetical) regardless of input order", () => {
    const a = buildMeshLayout(["z", "a", "m"]);
    const b = buildMeshLayout(["m", "z", "a"]);
    expect(a).toEqual(b);
  });

  it("rejects empty agent list", () => {
    expect(() => buildMeshLayout([])).toThrow();
  });

  it("rejects duplicate agent IDs", () => {
    expect(() => buildMeshLayout(["a", "b", "a"])).toThrow(/duplicate/i);
  });
});
