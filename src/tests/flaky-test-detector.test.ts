/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T04 — flaky test detector tests.
 */

import { describe, it, expect } from "vitest";
import {
  decideFlaky,
  shouldSampleFlakyCheck,
  getSampleRate,
  isFlakyDetectorDisabled,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_RERUN_COUNT,
} from "../core/hooks/flaky-test-detector.js";

describe("flaky-test-detector (E21.T04)", () => {
  it("DEFAULT_SAMPLE_RATE = 0.05 (5%) and DEFAULT_RERUN_COUNT = 3", () => {
    expect(DEFAULT_SAMPLE_RATE).toBe(0.05);
    expect(DEFAULT_RERUN_COUNT).toBe(3);
  });

  it("decideFlaky: all pass → not flaky", () => {
    expect(decideFlaky({ outcomes: ["pass", "pass", "pass"] })).toEqual({
      flaky: false, passes: 3, fails: 0,
    });
  });

  it("decideFlaky: all fail → not flaky (consistent failure)", () => {
    expect(decideFlaky({ outcomes: ["fail", "fail", "fail"] })).toEqual({
      flaky: false, passes: 0, fails: 3,
    });
  });

  it("decideFlaky: mixed outcomes → flaky", () => {
    expect(decideFlaky({ outcomes: ["pass", "fail", "pass"] }).flaky).toBe(true);
    expect(decideFlaky({ outcomes: ["fail", "pass"] }).flaky).toBe(true);
  });

  it("decideFlaky: empty list → not flaky", () => {
    expect(decideFlaky({ outcomes: [] }).flaky).toBe(false);
  });

  it("getSampleRate: env override valid", () => {
    expect(getSampleRate({ MCP_GRAPH_FLAKY_SAMPLE_RATE: "0.5" })).toBe(0.5);
    expect(getSampleRate({})).toBe(0.05);
  });

  it("getSampleRate: invalid env falls back to default", () => {
    expect(getSampleRate({ MCP_GRAPH_FLAKY_SAMPLE_RATE: "bad" })).toBe(0.05);
    expect(getSampleRate({ MCP_GRAPH_FLAKY_SAMPLE_RATE: "1.5" })).toBe(0.05);
    expect(getSampleRate({ MCP_GRAPH_FLAKY_SAMPLE_RATE: "-1" })).toBe(0.05);
  });

  it("shouldSampleFlakyCheck: rng returning value < rate → true", () => {
    expect(shouldSampleFlakyCheck(() => 0.01, {})).toBe(true);
  });

  it("shouldSampleFlakyCheck: rng returning value >= rate → false", () => {
    expect(shouldSampleFlakyCheck(() => 0.5, {})).toBe(false);
  });

  it("shouldSampleFlakyCheck: env disabled → always false", () => {
    expect(
      shouldSampleFlakyCheck(() => 0, { MCP_GRAPH_FLAKY_DETECTOR: "off" }),
    ).toBe(false);
  });

  it("isFlakyDetectorDisabled respects env toggle", () => {
    expect(isFlakyDetectorDisabled({ MCP_GRAPH_FLAKY_DETECTOR: "off" })).toBe(true);
    expect(isFlakyDetectorDisabled({})).toBe(false);
  });
});
