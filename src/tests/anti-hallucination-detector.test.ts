/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-13.3 — Anti-hallucination Guardrails
 */

import { describe, it, expect } from "vitest";
import {
  detectBannedPhrases,
  BANNED_PHRASES,
} from "../core/hooks/anti-hallucination-detector.js";

describe("detectBannedPhrases", () => {
  it("flags 'standard practice'", () => {
    const hits = detectBannedPhrases("This is standard practice for retries.");
    expect(hits).toContain("standard practice");
  });

  it("flags 'typically' (case-insensitive)", () => {
    const hits = detectBannedPhrases("Typically, the cache lives 5 minutes.");
    expect(hits).toContain("typically");
  });

  it("flags 'obviously' even mid-sentence", () => {
    const hits = detectBannedPhrases("This is obviously the right call.");
    expect(hits).toContain("obviously");
  });

  it("flags multiple banned phrases in one input", () => {
    const hits = detectBannedPhrases("Best practice is, typically, obviously correct.");
    expect(hits.sort()).toEqual(["best practice", "obviously", "typically"]);
  });

  it("returns empty array when text is clean", () => {
    expect(detectBannedPhrases("uses §ADR-0049 retry budget of 3")).toEqual([]);
  });

  it("does not flag substrings of larger words", () => {
    // 'normalize' contains 'normal' — must not match the 'normally' rule
    expect(detectBannedPhrases("normalize the input shape")).toEqual([]);
  });

  it("BANNED_PHRASES includes the canonical 3 from AC", () => {
    expect(BANNED_PHRASES).toEqual(expect.arrayContaining(["standard practice", "typically", "obviously"]));
  });

  it("ignores empty / null-ish input", () => {
    expect(detectBannedPhrases("")).toEqual([]);
    expect(detectBannedPhrases(undefined as unknown as string)).toEqual([]);
  });
});
