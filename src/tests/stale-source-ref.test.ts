/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T03 — stale-source-ref detector tests.
 */

import { describe, it, expect } from "vitest";
import {
  detectStaleSourceRef,
  STALE_AGE_DAYS,
  STALE_LOC_DELTA,
} from "../core/hooks/stale-source-ref.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("detectStaleSourceRef (E21.T03)", () => {
  it("STALE_AGE_DAYS = 14 (default minimum age before checking)", () => {
    expect(STALE_AGE_DAYS).toBe(14);
  });

  it("STALE_LOC_DELTA = 0.3 (30% LOC change threshold)", () => {
    expect(STALE_LOC_DELTA).toBe(0.3);
  });

  it("returns stale=false when file mtime is newer than node + STALE_AGE_DAYS", () => {
    const now = Date.now();
    const result = detectStaleSourceRef({
      createdAtMs: now - 10 * DAY_MS,
      mtimeMs: now,
      currentLineCount: 100,
      baselineLineCount: 100,
    });
    expect(result.stale).toBe(false);
  });

  it("returns stale=true when ageDays > 14 AND locDelta > 30%", () => {
    const now = Date.now();
    const result = detectStaleSourceRef({
      createdAtMs: now - 30 * DAY_MS,
      mtimeMs: now,
      currentLineCount: 200,
      baselineLineCount: 100,
    });
    expect(result.stale).toBe(true);
    expect(result.ageDays).toBeGreaterThan(14);
    expect(result.locDelta).toBeCloseTo(1.0); // 100% growth
  });

  it("returns stale=false when ageDays > 14 BUT locDelta < 30%", () => {
    const now = Date.now();
    const result = detectStaleSourceRef({
      createdAtMs: now - 30 * DAY_MS,
      mtimeMs: now,
      currentLineCount: 105,
      baselineLineCount: 100,
    });
    expect(result.stale).toBe(false);
    expect(result.locDelta).toBeCloseTo(0.05);
  });

  it("returns stale=false when no baseline available (cannot compute delta)", () => {
    const now = Date.now();
    const result = detectStaleSourceRef({
      createdAtMs: now - 30 * DAY_MS,
      mtimeMs: now,
      currentLineCount: 200,
      // baselineLineCount omitted
    });
    expect(result.stale).toBe(false);
  });

  it("supports custom thresholds via opts override", () => {
    const now = Date.now();
    const result = detectStaleSourceRef(
      {
        createdAtMs: now - 5 * DAY_MS,
        mtimeMs: now,
        currentLineCount: 200,
        baselineLineCount: 100,
      },
      { minAgeDays: 1, locDeltaThreshold: 0.1 },
    );
    expect(result.stale).toBe(true);
  });

  it("locDelta uses absolute relative change (handles shrink and grow)", () => {
    const now = Date.now();
    const grew = detectStaleSourceRef({
      createdAtMs: now - 30 * DAY_MS,
      mtimeMs: now,
      currentLineCount: 150,
      baselineLineCount: 100,
    });
    expect(grew.locDelta).toBeCloseTo(0.5);

    const shrunk = detectStaleSourceRef({
      createdAtMs: now - 30 * DAY_MS,
      mtimeMs: now,
      currentLineCount: 50,
      baselineLineCount: 100,
    });
    expect(shrunk.locDelta).toBeCloseTo(0.5);
  });

  it("ageDays computed from mtimeMs - createdAtMs (file age, not node age)", () => {
    const now = Date.now();
    const result = detectStaleSourceRef({
      createdAtMs: now - 30 * DAY_MS,
      mtimeMs: now - 5 * DAY_MS, // file unchanged for 25 days but only 5d after createdAt is "fresh"
      currentLineCount: 200,
      baselineLineCount: 100,
    });
    // mtime - createdAt = 25 days → above STALE_AGE_DAYS threshold
    expect(result.ageDays).toBeGreaterThan(14);
  });
});
