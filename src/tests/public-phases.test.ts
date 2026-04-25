/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Contract tests for src/core/pipeline/public-phases.ts.
 *
 * The mapping between 9 internal phases and 4 public phases is the
 * load-bearing contract that the user's onboarding guide and Copilot CLI
 * skills rely on. These tests pin it down.
 */

import { describe, expect, it } from "vitest";
import type { LifecyclePhase } from "../core/planner/lifecycle-phase.js";
import {
  getPublicPhase,
  getPublicPhaseLabel,
  isValidTransition,
  listInternalPhasesFor,
  PUBLIC_PHASE_ORDER,
  type PublicPhase,
} from "../core/pipeline/public-phases.js";

const ALL_INTERNAL_PHASES: LifecyclePhase[] = [
  "ANALYZE",
  "DESIGN",
  "PLAN",
  "IMPLEMENT",
  "VALIDATE",
  "REVIEW",
  "HANDOFF",
  "DEPLOY",
  "LISTENING",
];

describe("public-phases — mapping coverage", () => {
  it("every one of the 9 internal phases maps to a valid public phase", () => {
    const validPublic = new Set<PublicPhase>(PUBLIC_PHASE_ORDER);
    for (const internal of ALL_INTERNAL_PHASES) {
      const pub = getPublicPhase(internal);
      expect(validPublic.has(pub), `internal ${internal} mapped to invalid public ${pub}`).toBe(true);
    }
  });

  it("the 4 public phases are exactly ANALYZE, DESIGN, PLAN, IMPLEMENT", () => {
    expect([...PUBLIC_PHASE_ORDER]).toEqual(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT"]);
  });

  it("matches the user's onboarding guide mapping (T4.9 spec)", () => {
    expect(getPublicPhase("ANALYZE")).toBe("ANALYZE");
    expect(getPublicPhase("DESIGN")).toBe("DESIGN");
    expect(getPublicPhase("PLAN")).toBe("PLAN");
    expect(getPublicPhase("IMPLEMENT")).toBe("IMPLEMENT");
    expect(getPublicPhase("VALIDATE")).toBe("IMPLEMENT");
    expect(getPublicPhase("REVIEW")).toBe("IMPLEMENT");
    expect(getPublicPhase("HANDOFF")).toBe("IMPLEMENT");
    expect(getPublicPhase("DEPLOY")).toBe("IMPLEMENT");
    expect(getPublicPhase("LISTENING")).toBe("ANALYZE");
  });
});

describe("public-phases — labels", () => {
  it("returns a non-empty label for every public phase", () => {
    for (const phase of PUBLIC_PHASE_ORDER) {
      const label = getPublicPhaseLabel(phase);
      expect(label.length).toBeGreaterThan(0);
      expect(label.startsWith(phase)).toBe(true);
    }
  });
});

describe("public-phases — transitions", () => {
  it("same-phase transition is always allowed (no-op)", () => {
    for (const phase of PUBLIC_PHASE_ORDER) {
      expect(isValidTransition(phase, phase)).toBe(true);
    }
  });

  it("one step forward is allowed", () => {
    expect(isValidTransition("ANALYZE", "DESIGN")).toBe(true);
    expect(isValidTransition("DESIGN", "PLAN")).toBe(true);
    expect(isValidTransition("PLAN", "IMPLEMENT")).toBe(true);
  });

  it("skipping forward is rejected (gates would be unmet)", () => {
    expect(isValidTransition("ANALYZE", "PLAN")).toBe(false);
    expect(isValidTransition("ANALYZE", "IMPLEMENT")).toBe(false);
    expect(isValidTransition("DESIGN", "IMPLEMENT")).toBe(false);
  });

  it("backward transitions are always allowed (blocker surfaced)", () => {
    expect(isValidTransition("IMPLEMENT", "PLAN")).toBe(true);
    expect(isValidTransition("IMPLEMENT", "DESIGN")).toBe(true);
    expect(isValidTransition("IMPLEMENT", "ANALYZE")).toBe(true);
    expect(isValidTransition("PLAN", "ANALYZE")).toBe(true);
  });
});

describe("public-phases — reverse lookup", () => {
  it("listInternalPhasesFor(ANALYZE) returns ANALYZE + LISTENING", () => {
    const internals = listInternalPhasesFor("ANALYZE").sort();
    expect(internals).toEqual(["ANALYZE", "LISTENING"]);
  });

  it("listInternalPhasesFor(IMPLEMENT) returns the 5 implement-bucket internals", () => {
    const internals = listInternalPhasesFor("IMPLEMENT").sort();
    expect(internals).toEqual(["DEPLOY", "HANDOFF", "IMPLEMENT", "REVIEW", "VALIDATE"]);
  });

  it("listInternalPhasesFor(DESIGN) returns just DESIGN", () => {
    expect(listInternalPhasesFor("DESIGN")).toEqual(["DESIGN"]);
  });

  it("listInternalPhasesFor(PLAN) returns just PLAN", () => {
    expect(listInternalPhasesFor("PLAN")).toEqual(["PLAN"]);
  });

  it("the union of all reverse lookups covers all 9 internal phases", () => {
    const seen = new Set<LifecyclePhase>();
    for (const pub of PUBLIC_PHASE_ORDER) {
      for (const internal of listInternalPhasesFor(pub)) {
        seen.add(internal);
      }
    }
    expect(seen.size).toBe(ALL_INTERNAL_PHASES.length);
    for (const internal of ALL_INTERNAL_PHASES) {
      expect(seen.has(internal), `phase ${internal} not covered by any public phase`).toBe(true);
    }
  });
});
