/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { analyzeTrajectory } from "../core/skills/trajectory-analyzer.js";

describe("analyzeTrajectory() — heuristic detection", () => {
  it("returns shouldPropose=false when no heuristic triggers", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 60_000,
      estimateMinutes: 2,
      adrCreated: false,
      summary: "Normal completion.",
    });
    expect(result.shouldPropose).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("triggers 'retries' when cycle_time > 2x estimateMinutes", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 600_000,   // 10 min
      estimateMinutes: 5,      // estimate 5 min → ratio 2× exactly is NOT > 2
      adrCreated: false,
      summary: "",
    });
    // 10min / 5min = 2 exactly → not > 2
    expect(result.shouldPropose).toBe(false);
  });

  it("triggers 'retries' when cycle_time strictly exceeds 2x estimate", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 610_000,   // 10.17 min
      estimateMinutes: 5,
      adrCreated: false,
      summary: "",
    });
    expect(result.shouldPropose).toBe(true);
    expect(result.reasons).toContain("retries");
  });

  it("triggers 'adr' when adrCreated is true", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 60_000,
      estimateMinutes: 60,
      adrCreated: true,
      summary: "Routine finish.",
    });
    expect(result.shouldPropose).toBe(true);
    expect(result.reasons).toContain("adr");
  });

  it("triggers 'discovered' when summary contains 'discovered'", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 60_000,
      estimateMinutes: 60,
      adrCreated: false,
      summary: "I discovered a hidden constraint in the DB schema.",
    });
    expect(result.shouldPropose).toBe(true);
    expect(result.reasons).toContain("discovered");
  });

  it("triggers 'discovered' when summary contains 'não-óbvio'", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 60_000,
      estimateMinutes: 60,
      adrCreated: false,
      summary: "Encontrei comportamento não-óbvio no parser.",
    });
    expect(result.shouldPropose).toBe(true);
    expect(result.reasons).toContain("discovered");
  });

  it("accumulates multiple reasons when several heuristics fire", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 900_000,   // 15 min
      estimateMinutes: 5,      // > 2×
      adrCreated: true,
      summary: "discovered edge case and não-óbvio behavior",
    });
    expect(result.shouldPropose).toBe(true);
    expect(result.reasons).toContain("retries");
    expect(result.reasons).toContain("adr");
    expect(result.reasons).toContain("discovered");
    expect(result.reasons).toHaveLength(3);
  });

  it("skips retries heuristic when estimateMinutes is 0 or undefined", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 900_000,
      estimateMinutes: 0,
      adrCreated: false,
      summary: "",
    });
    expect(result.reasons).not.toContain("retries");
  });

  it("is case-insensitive for 'discovered' keyword", () => {
    const result = analyzeTrajectory({
      cycleTimeMs: 0,
      estimateMinutes: 0,
      adrCreated: false,
      summary: "DISCOVERED something unexpected",
    });
    expect(result.shouldPropose).toBe(true);
    expect(result.reasons).toContain("discovered");
  });
});
