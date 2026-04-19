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

/**
 * Tests for challenge-report.ts — Challenge Report Assembler.
 *
 * AC1: assembleChallengeReport returns all sections
 * AC2: Findings sorted by severity within sections
 * AC3: Composite < 60 → CHALLENGE_FAILED
 * AC4: Composite >= 60 & zero critical → CHALLENGE_PASSED
 * AC5: 3 context tiers (summary, standard, deep)
 */

import { describe, it, expect } from "vitest";
import {
  assembleChallengeReport,
  serializeChallengeReport,
  type ChallengeReportInput,
} from "../core/designer/challenge-report.js";
import type { DecisionFitnessResult } from "../core/designer/decision-fitness.js";
import type { Finding } from "../core/designer/severity-scoring.js";

function makeGoodFitness(): DecisionFitnessResult {
  return {
    composite: 75,
    grade: "B",
    breakdown: {
      friction: { score: 80, weight: 0.4 },
      optimality: { score: 70, weight: 0.35 },
      reversibility: { score: 75, weight: 0.25 },
    },
  };
}

function makeBadFitness(): DecisionFitnessResult {
  return {
    composite: 35,
    grade: "D",
    breakdown: {
      friction: { score: 30, weight: 0.4 },
      optimality: { score: 40, weight: 0.35 },
      reversibility: { score: 35, weight: 0.25 },
    },
  };
}

function makeJtbdResults(): ChallengeReportInput["jtbdResults"] {
  return [
    { jtbd: "When offline, I want local storage", result: "PASS", score: 0.8 },
    { jtbd: "When scaling, I want cloud sync", result: "FAIL", score: 0.05 },
  ];
}

function makeFindings(severity: "critical" | "warning" | "info"): Finding[] {
  return [
    { message: `${severity} finding`, source: "fitness", dimension: "friction", severity },
  ];
}

describe("challenge-report", () => {
  // AC1: Report has all sections
  it("should return report with all required sections", () => {
    const input: ChallengeReportInput = {
      fitness: makeGoodFitness(),
      jtbdResults: makeJtbdResults(),
      preMortemFindings: makeFindings("warning"),
    };

    const report = assembleChallengeReport(input);

    expect(report.fitnessScore).toBeDefined();
    expect(report.fitnessScore.composite).toBe(75);
    expect(report.fitnessScore.breakdown).toBeDefined();
    expect(report.jtbdResults).toHaveLength(2);
    expect(report.preMortemFindings).toBeDefined();
    expect(report.challengeQuestions.length).toBeGreaterThanOrEqual(3);
    expect(report.overallVerdict).toBeDefined();
  });

  // AC2: Findings sorted by severity
  it("should sort findings by severity within preMortemFindings", () => {
    const findings: Finding[] = [
      { message: "info", source: "premortem", dimension: "general", severity: "info" },
      { message: "critical", source: "premortem", dimension: "friction", severity: "critical" },
      { message: "warning", source: "premortem", dimension: "optimality", severity: "warning" },
    ];

    const report = assembleChallengeReport({
      fitness: makeGoodFitness(),
      jtbdResults: [],
      preMortemFindings: findings,
    });

    expect(report.preMortemFindings[0].severity).toBe("critical");
    expect(report.preMortemFindings[1].severity).toBe("warning");
    expect(report.preMortemFindings[2].severity).toBe("info");
  });

  // AC3: Composite < 60 → CHALLENGE_FAILED
  it("should return CHALLENGE_FAILED when composite < 60", () => {
    const report = assembleChallengeReport({
      fitness: makeBadFitness(),
      jtbdResults: makeJtbdResults(),
      preMortemFindings: makeFindings("critical"),
    });

    expect(report.overallVerdict.verdict).toBe("CHALLENGE_FAILED");
    expect(report.overallVerdict.criticalBlockers.length).toBeGreaterThan(0);
  });

  // AC4: Composite >= 60 & zero critical → CHALLENGE_PASSED
  it("should return CHALLENGE_PASSED when composite >= 60 and zero critical findings", () => {
    const report = assembleChallengeReport({
      fitness: makeGoodFitness(),
      jtbdResults: [{ jtbd: "When offline, I want storage", result: "PASS", score: 0.9 }],
      preMortemFindings: makeFindings("warning"),
    });

    expect(report.overallVerdict.verdict).toBe("CHALLENGE_PASSED");
    expect(report.overallVerdict.warnings.length).toBeGreaterThanOrEqual(1);
  });

  // AC4 edge: composite >= 60 but has critical findings → still FAILED
  it("should return CHALLENGE_FAILED when composite >= 60 but has critical findings", () => {
    const report = assembleChallengeReport({
      fitness: makeGoodFitness(),
      jtbdResults: makeJtbdResults(),
      preMortemFindings: makeFindings("critical"),
    });

    expect(report.overallVerdict.verdict).toBe("CHALLENGE_FAILED");
  });

  // AC5: Context tiers
  describe("serializeChallengeReport", () => {
    it("should produce summary tier (~30 tokens)", () => {
      const report = assembleChallengeReport({
        fitness: makeGoodFitness(),
        jtbdResults: makeJtbdResults(),
        preMortemFindings: makeFindings("warning"),
      });

      const summary = serializeChallengeReport(report, "summary");
      expect(summary.length).toBeLessThan(200);
      expect(summary).toContain(report.overallVerdict.verdict);
    });

    it("should produce standard tier (~200 tokens)", () => {
      const report = assembleChallengeReport({
        fitness: makeGoodFitness(),
        jtbdResults: makeJtbdResults(),
        preMortemFindings: makeFindings("warning"),
      });

      const standard = serializeChallengeReport(report, "standard");
      expect(standard.length).toBeGreaterThan(100); // standard is longer than summary
      expect(standard.length).toBeLessThan(1500);
      expect(standard).toContain("Fitness");
    });

    it("should produce deep tier (~500+ tokens)", () => {
      const report = assembleChallengeReport({
        fitness: makeGoodFitness(),
        jtbdResults: makeJtbdResults(),
        preMortemFindings: makeFindings("warning"),
      });

      const deep = serializeChallengeReport(report, "deep");
      expect(deep.length).toBeGreaterThan(300); // deep is the longest tier
      expect(deep).toContain("Challenge");
    });
  });
});
