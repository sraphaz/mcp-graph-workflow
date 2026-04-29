/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { wrapDesignPhaseAdvisory } from "../core/analyzer/out-of-phase-advisory.js";
import type { LifecyclePhase } from "../core/planner/lifecycle-phase.js";

describe("wrapDesignPhaseAdvisory (BUG-06-B)", () => {
  const data = { foo: 1, bar: ["a", "b"] };

  it("when phase === DESIGN: returns { ok, mode, ...data } without advisory", () => {
    const out = wrapDesignPhaseAdvisory("DESIGN", "traceability", data);
    expect(out.ok).toBe(true);
    expect(out.mode).toBe("traceability");
    expect(out.advisory).toBeUndefined();
    expect(out.phaseWarning).toBeUndefined();
    expect((out as Record<string, unknown>).foo).toBe(1);
  });

  it("when phase !== DESIGN: returns { ok, mode, advisory: true, phaseWarning, data }", () => {
    const out = wrapDesignPhaseAdvisory("PLAN" as LifecyclePhase, "traceability", data);
    expect(out.advisory).toBe(true);
    expect(out.phaseWarning).toContain("traceability");
    expect(out.phaseWarning).toContain("PLAN");
    expect(out.data).toEqual(data);
    // Original report fields are NOT spread at the top level when wrapped
    expect((out as Record<string, unknown>).foo).toBeUndefined();
  });

  it("phaseWarning mentions running in DESIGN for gate enforcement", () => {
    const out = wrapDesignPhaseAdvisory("IMPLEMENT" as LifecyclePhase, "coupling", data);
    expect(out.phaseWarning?.toLowerCase()).toContain("design");
  });

  it("works with all 5 covered modes", () => {
    for (const mode of ["traceability", "coupling", "interfaces", "tech_risk", "design_ready"] as const) {
      const out = wrapDesignPhaseAdvisory("ANALYZE" as LifecyclePhase, mode, data);
      expect(out.advisory).toBe(true);
      expect(out.phaseWarning).toContain(mode);
    }
  });
});
