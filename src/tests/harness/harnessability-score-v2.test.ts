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
  computeHarnessabilityScore,
  type HarnessabilityInput,
} from "../../core/harness/harnessability-score.js";

describe("computeHarnessabilityScore — 8 dimensions", () => {
  it("weights sum to exactly 1.0", () => {
    // Derive from known constants by checking perfect score
    const result = computeHarnessabilityScore({
      typeScore: 100,
      testScore: 100,
      fitnessScore: 100,
      docsScore: 100,
      namingScore: 100,
      errorHandlingScore: 100,
      contextDensityScore: 100,
      provenanceScore: 100,
    });
    expect(result.score).toBe(100);
  });

  it("legacy 4-field input uses default 100 for new fields and returns valid result", () => {
    const input: HarnessabilityInput = {
      typeScore: 80,
      testScore: 80,
      fitnessScore: 80,
      docsScore: 80,
    };
    const result = computeHarnessabilityScore(input);
    expect(result.score).toBeGreaterThan(0);
    expect(result.grade).toMatch(/^[ABCD]$/);
    expect(result.breakdown).toHaveProperty("naming");
    expect(result.breakdown).toHaveProperty("errors");
    expect(result.breakdown).toHaveProperty("context");
  });

  it("all 8 scores = 100 produces score 100 and grade A", () => {
    const result = computeHarnessabilityScore({
      typeScore: 100,
      testScore: 100,
      fitnessScore: 100,
      docsScore: 100,
      namingScore: 100,
      errorHandlingScore: 100,
      contextDensityScore: 100,
      provenanceScore: 100,
    });
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("applies correct weights: types=0.25, tests=0.25, fitness=0.15, docs=0.10, naming=0.10, errors=0.05, context=0.05, provenance=0.05", () => {
    // Only typeScore = 100, rest = 0 → score should be 25
    const result = computeHarnessabilityScore({
      typeScore: 100,
      testScore: 0,
      fitnessScore: 0,
      docsScore: 0,
      namingScore: 0,
      errorHandlingScore: 0,
      contextDensityScore: 0,
      provenanceScore: 0,
    });
    expect(result.score).toBe(25);
    expect(result.breakdown.types.weight).toBe(0.25);
    expect(result.breakdown.tests.weight).toBe(0.25);
    expect(result.breakdown.fitness.weight).toBe(0.15);
    expect(result.breakdown.docs.weight).toBe(0.10);
    expect(result.breakdown.naming.weight).toBe(0.10);
    expect(result.breakdown.errors.weight).toBe(0.05);
    expect(result.breakdown.context.weight).toBe(0.05);
    expect(result.breakdown.provenance.weight).toBe(0.05);
  });

  it("naming dimension correctly weighted at 0.10", () => {
    const result = computeHarnessabilityScore({
      typeScore: 0,
      testScore: 0,
      fitnessScore: 0,
      docsScore: 0,
      namingScore: 100,
      errorHandlingScore: 0,
      contextDensityScore: 0,
      provenanceScore: 0,
    });
    expect(result.score).toBe(10);
  });

  it("errors dimension correctly weighted at 0.05", () => {
    const result = computeHarnessabilityScore({
      typeScore: 0,
      testScore: 0,
      fitnessScore: 0,
      docsScore: 0,
      namingScore: 0,
      errorHandlingScore: 100,
      contextDensityScore: 0,
      provenanceScore: 0,
    });
    expect(result.score).toBe(5);
  });

  it("context dimension correctly weighted at 0.05", () => {
    const result = computeHarnessabilityScore({
      typeScore: 0,
      testScore: 0,
      fitnessScore: 0,
      docsScore: 0,
      namingScore: 0,
      errorHandlingScore: 0,
      contextDensityScore: 100,
      provenanceScore: 0,
    });
    expect(result.score).toBe(5);
  });

  it("breakdown includes all 8 dimensions with correct scores", () => {
    const result = computeHarnessabilityScore({
      typeScore: 90,
      testScore: 80,
      fitnessScore: 70,
      docsScore: 60,
      namingScore: 50,
      errorHandlingScore: 40,
      contextDensityScore: 30,
      provenanceScore: 20,
    });
    expect(result.breakdown.types.score).toBe(90);
    expect(result.breakdown.tests.score).toBe(80);
    expect(result.breakdown.fitness.score).toBe(70);
    expect(result.breakdown.docs.score).toBe(60);
    expect(result.breakdown.naming.score).toBe(50);
    expect(result.breakdown.errors.score).toBe(40);
    expect(result.breakdown.context.score).toBe(30);
    expect(result.breakdown.provenance.score).toBe(20);
  });
});
