/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  quadrantOf,
  quadrantRank,
  QUADRANT_THRESHOLDS,
} from "../core/feature-depth/quadrant.js";
import { detectQuadrantCrossing } from "../core/feature-depth/quadrant-crossing.js";

describe("quadrantOf", () => {
  it("classifies the four bands", () => {
    expect(quadrantOf(85)).toBe("MATURE");
    expect(quadrantOf(70)).toBe("MATURE"); // boundary inclusive
    expect(quadrantOf(60)).toBe("SPECIALIZED");
    expect(quadrantOf(50)).toBe("SPECIALIZED"); // boundary inclusive
    expect(quadrantOf(40)).toBe("SHALLOW");
    expect(quadrantOf(30)).toBe("SHALLOW"); // boundary inclusive
    expect(quadrantOf(20)).toBe("INCIPIENT");
    expect(quadrantOf(0)).toBe("INCIPIENT");
  });

  it("threshold constants match the documented bands", () => {
    expect(QUADRANT_THRESHOLDS.matureMin).toBe(70);
    expect(QUADRANT_THRESHOLDS.specializedMin).toBe(50);
    expect(QUADRANT_THRESHOLDS.shallowMin).toBe(30);
  });
});

describe("quadrantRank", () => {
  it("orders quadrants from worst to best", () => {
    expect(quadrantRank("INCIPIENT")).toBeLessThan(quadrantRank("SHALLOW"));
    expect(quadrantRank("SHALLOW")).toBeLessThan(quadrantRank("SPECIALIZED"));
    expect(quadrantRank("SPECIALIZED")).toBeLessThan(quadrantRank("MATURE"));
  });
});

describe("detectQuadrantCrossing", () => {
  it("returns null when the file stayed in the same quadrant", () => {
    expect(detectQuadrantCrossing(55, 60)).toBeNull(); // both SPECIALIZED
    expect(detectQuadrantCrossing(75, 80)).toBeNull(); // both MATURE
  });

  it("returns null for a fresh file (no prior baseline)", () => {
    expect(detectQuadrantCrossing(null, 65)).toBeNull();
    expect(detectQuadrantCrossing(null, 30)).toBeNull();
  });

  it("detects upward crossing — SHALLOW → SPECIALIZED", () => {
    const e = detectQuadrantCrossing(40, 55);
    expect(e).not.toBeNull();
    expect(e?.from).toBe("SHALLOW");
    expect(e?.to).toBe("SPECIALIZED");
    expect(e?.direction).toBe("up");
    expect(e?.delta).toBe(15);
  });

  it("detects upward crossing skipping multiple quadrants — INCIPIENT → MATURE", () => {
    const e = detectQuadrantCrossing(20, 80);
    expect(e?.from).toBe("INCIPIENT");
    expect(e?.to).toBe("MATURE");
    expect(e?.direction).toBe("up");
  });

  it("detects downward crossing — MATURE → SHALLOW", () => {
    const e = detectQuadrantCrossing(75, 40);
    expect(e?.from).toBe("MATURE");
    expect(e?.to).toBe("SHALLOW");
    expect(e?.direction).toBe("down");
    expect(e?.delta).toBe(-35);
  });

  it("preserves prior + current scores in the event", () => {
    const e = detectQuadrantCrossing(28.5, 72.1);
    expect(e?.priorScore).toBe(28.5);
    expect(e?.currentScore).toBe(72.1);
  });
});
