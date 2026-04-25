/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect } from "vitest";
import {
  getModesForPhase,
  ALL_ANALYZE_MODES,
  type AnalyzeMode,
  type LifecyclePhase,
} from "../core/planner/lifecycle-phase.js";

describe("getModesForPhase — V11 Maestro Phase 3", () => {
  it("returns the DESIGN modes per the PRD acceptance criterion", () => {
    const modes = getModesForPhase("DESIGN");
    // PRD: "phase=DESIGN → [adr, traceability, coupling, interfaces, tech_risk, design_ready, adr_challenge]"
    expect(modes).toContain("adr");
    expect(modes).toContain("traceability");
    expect(modes).toContain("coupling");
    expect(modes).toContain("interfaces");
    expect(modes).toContain("tech_risk");
    expect(modes).toContain("design_ready");
    expect(modes).toContain("adr_challenge");
  });

  it("returns an empty array for an invalid phase (no throw)", () => {
    const modes = getModesForPhase("NOT_A_PHASE" as LifecyclePhase);
    expect(modes).toEqual([]);
  });

  it("never returns duplicates within a single phase", () => {
    for (const phase of ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING"] as LifecyclePhase[]) {
      const modes = getModesForPhase(phase);
      const unique = new Set(modes);
      expect(unique.size).toBe(modes.length);
    }
  });

  it("covers every analyze mode in EXACTLY ONE phase (no orphans, no duplicates across phases)", () => {
    const seen = new Map<AnalyzeMode, LifecyclePhase>();
    for (const phase of ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING"] as LifecyclePhase[]) {
      for (const mode of getModesForPhase(phase)) {
        if (seen.has(mode)) {
          throw new Error(`mode "${mode}" assigned to both ${seen.get(mode)} and ${phase}`);
        }
        seen.set(mode, phase);
      }
    }
    // Every mode in ALL_ANALYZE_MODES must be assigned
    for (const mode of ALL_ANALYZE_MODES) {
      expect(seen.has(mode), `mode "${mode}" is unassigned (orphan)`).toBe(true);
    }
    expect(seen.size).toBe(ALL_ANALYZE_MODES.length);
  });

  it("ALL_ANALYZE_MODES has exactly 53 entries (matches analyze.ts enum)", () => {
    expect(ALL_ANALYZE_MODES.length).toBe(53);
  });

  it.each([
    ["ANALYZE", "prd_quality"],
    ["IMPLEMENT", "tdd_check"],
    ["VALIDATE", "validate_ready"],
    ["REVIEW", "harness_scan"],
    ["HANDOFF", "handoff_ready"],
    ["DEPLOY", "deploy_ready"],
    ["LISTENING", "listening_ready"],
    ["PLAN", "backlog_health"],
  ])("phase %s contains mode %s", (phase, mode) => {
    expect(getModesForPhase(phase as LifecyclePhase)).toContain(mode);
  });
});
