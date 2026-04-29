/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { validateSwarmTopologyGate, SwarmTopologyGateError } from "../core/swarm/swarm-lifecycle-gate.js";
import type { Topology } from "../core/swarm/swarm-types.js";

const ALLOWED_PHASES = ["IMPLEMENT", "VALIDATE"] as const;
const BLOCKED_PHASES = ["ANALYZE", "DESIGN", "PLAN", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING"] as const;

const topology: Topology = "hierarchical";

describe("validateSwarmTopologyGate — allowed phases", () => {
  for (const phase of ALLOWED_PHASES) {
    it(`allows swarmTopology in ${phase}`, () => {
      expect(() => validateSwarmTopologyGate(phase, topology)).not.toThrow();
    });
  }

  it("passes when swarmTopology is undefined (no-op)", () => {
    for (const phase of BLOCKED_PHASES) {
      expect(() => validateSwarmTopologyGate(phase, undefined)).not.toThrow();
    }
  });
});

describe("validateSwarmTopologyGate — blocked phases", () => {
  for (const phase of BLOCKED_PHASES) {
    it(`rejects swarmTopology in ${phase}`, () => {
      expect(() => validateSwarmTopologyGate(phase, topology)).toThrow(SwarmTopologyGateError);
    });
  }

  it("error is typed as SwarmTopologyGateError", () => {
    let caught: unknown;
    try {
      validateSwarmTopologyGate("ANALYZE", "mesh");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SwarmTopologyGateError);
  });

  it("error.phase matches the rejected phase", () => {
    let caught: unknown;
    try {
      validateSwarmTopologyGate("DESIGN", "star");
    } catch (err) {
      caught = err;
    }
    const e = caught as SwarmTopologyGateError;
    expect(e.phase).toBe("DESIGN");
    expect(e.topology).toBe("star");
  });

  it("strict mode (default) throws; advisory mode returns warning instead", () => {
    const result = validateSwarmTopologyGate("ANALYZE", "ring", { mode: "advisory" });
    expect(result).toBeDefined();
    expect(result?.warning).toContain("ANALYZE");
  });
});
