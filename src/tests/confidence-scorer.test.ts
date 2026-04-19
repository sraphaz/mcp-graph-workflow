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
  computeConfidence,
  type ConfidenceInput,
} from "../core/autonomy/confidence-scorer.js";

describe("Confidence Scorer — Decision Theory (von Neumann & Morgenstern)", () => {
  it("should return ~85 with action=continue for high-quality signals", () => {
    const input: ConfidenceInput = {
      ragRelevance: 0.9,
      harnessScore: 85,
      historicalSuccessRate: 0.8,
    };

    const result = computeConfidence(input);

    // 0.9*40 + 85*0.30 + 80*0.30 = 36 + 25.5 + 24 = 85.5
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(90);
    expect(result.action).toBe("continue");
  });

  it("should return ~38 with action=stop for low-quality signals", () => {
    const input: ConfidenceInput = {
      ragRelevance: 0.3,
      harnessScore: 50,
      historicalSuccessRate: 0.4,
    };

    const result = computeConfidence(input);

    // 0.3*40 + 50*0.30 + 40*0.30 = 12 + 15 + 12 = 39
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThanOrEqual(45);
    expect(result.action).toBe("stop");
  });

  it("should return action=pause for score between 50-70", () => {
    const input: ConfidenceInput = {
      ragRelevance: 0.6,
      harnessScore: 65,
      historicalSuccessRate: 0.6,
    };

    const result = computeConfidence(input);

    // 0.6*40 + 65*0.30 + 60*0.30 = 24 + 19.5 + 18 = 61.5
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(70);
    expect(result.action).toBe("pause");
  });

  it("should include evidence breakdown in result", () => {
    const input: ConfidenceInput = {
      ragRelevance: 0.75,
      harnessScore: 70,
      historicalSuccessRate: 0.65,
    };

    const result = computeConfidence(input);

    expect(result.evidence).toBeDefined();
    expect(result.evidence.ragRelevance).toBe(0.75);
    expect(result.evidence.harnessScore).toBe(70);
    expect(result.evidence.historicalSuccessRate).toBe(0.65);
    expect(result.evidence.ragContribution).toBeGreaterThan(0);
    expect(result.evidence.harnessContribution).toBeGreaterThan(0);
    expect(result.evidence.historicalContribution).toBeGreaterThan(0);
  });

  it("should clamp score to 0-100 range", () => {
    const highInput: ConfidenceInput = {
      ragRelevance: 1.0,
      harnessScore: 100,
      historicalSuccessRate: 1.0,
    };

    const result = computeConfidence(highInput);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should handle zero values gracefully", () => {
    const input: ConfidenceInput = {
      ragRelevance: 0,
      harnessScore: 0,
      historicalSuccessRate: 0,
    };

    const result = computeConfidence(input);
    expect(result.score).toBe(0);
    expect(result.action).toBe("stop");
  });
});
