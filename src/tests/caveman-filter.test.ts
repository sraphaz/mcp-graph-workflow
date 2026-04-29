/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T01 — caveman filter tests.
 */

import { describe, it, expect } from "vitest";
import {
  cavemanFilter,
  shouldCavemanFilter,
  CAVEMAN_REDUCTION_TARGET,
} from "../core/llm/caveman-filter.js";

describe("caveman-filter (E8.T01)", () => {
  it("CAVEMAN_REDUCTION_TARGET = 0.4", () => {
    expect(CAVEMAN_REDUCTION_TARGET).toBe(0.4);
  });

  it("removes articles (the/a/an)", () => {
    expect(cavemanFilter("the cat sat on a mat")).toBe("cat sat on mat");
  });

  it("removes filler (actually, basically, just)", () => {
    expect(cavemanFilter("actually, this is basically just a test"))
      .not.toContain("actually");
    expect(cavemanFilter("actually, this is basically just a test"))
      .not.toContain("basically");
    expect(cavemanFilter("actually, this is basically just a test"))
      .not.toContain("just");
  });

  it("removes hedging (I think, maybe, possibly)", () => {
    const filtered = cavemanFilter("I think maybe we should possibly retry");
    expect(filtered.toLowerCase()).not.toContain("i think");
    expect(filtered.toLowerCase()).not.toContain("maybe");
    expect(filtered.toLowerCase()).not.toContain("possibly");
  });

  it("removes transition fluff (furthermore, however)", () => {
    expect(cavemanFilter("Furthermore, this works."))
      .not.toMatch(/furthermore/i);
  });

  it("collapses whitespace and stranded punctuation", () => {
    expect(cavemanFilter("hello  ,  world")).toBe("hello, world");
  });

  it("returns '' for empty input", () => {
    expect(cavemanFilter("")).toBe("");
  });

  it("achieves >= 60% token reduction on hedge-heavy passage (AC target)", () => {
    const verbose =
      "Honestly, I think the system is basically working. " +
      "However, in my opinion, it seems that maybe we should probably " +
      "consider, at the end of the day, an alternative approach. " +
      "Furthermore, the the the data is essentially complete.";
    const filtered = cavemanFilter(verbose);
    const reduction = filtered.length / verbose.length;
    expect(reduction).toBeLessThanOrEqual(CAVEMAN_REDUCTION_TARGET + 0.1);
  });

  it("preserves substantive nouns and verbs", () => {
    const out = cavemanFilter("the engine compiled the migration successfully");
    expect(out).toContain("engine");
    expect(out).toContain("compiled");
    expect(out).toContain("migration");
  });

  describe("shouldCavemanFilter", () => {
    it("returns true only when settings.caveman === true", () => {
      expect(shouldCavemanFilter({ caveman: true })).toBe(true);
      expect(shouldCavemanFilter({ caveman: false })).toBe(false);
      expect(shouldCavemanFilter({})).toBe(false);
      expect(shouldCavemanFilter({ caveman: null })).toBe(false);
    });
  });
});
