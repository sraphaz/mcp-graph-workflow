/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Lê memory por hostname + agrupa
 *
 * AC1: GIVEN memory com 50 entries para acme.com WHEN aggregate THEN agrupa por path pattern
 * AC2: GIVEN selector confirmado em ≥2 datas distintas WHEN agregação roda THEN entra como "positive"
 * AC3: GIVEN selector listado como trap em alguma run WHEN agregação roda THEN entra como "negative"
 * AC4: GIVEN sem entries WHEN aggregate THEN retorna []
 */

import { describe, it, expect } from "vitest";
import { aggregateBySite } from "../../core/browser-harness/skill-promoter.js";
import type { BrowserTestEntry } from "../../core/browser-harness/skill-promoter.js";

function makeEntry(overrides: Partial<BrowserTestEntry> = {}): BrowserTestEntry {
  return {
    hostname: "acme.com",
    url: "https://acme.com/login",
    selector: "#username",
    confirmedAt: "2026-01-01T10:00:00Z",
    trap: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: groups by path pattern
// ---------------------------------------------------------------------------

describe("aggregateBySite — AC1: groups by path pattern", () => {
  it("should return one SkillCandidate per (path pattern, selector) pair", () => {
    const entries: BrowserTestEntry[] = Array.from({ length: 25 }, () =>
      makeEntry({ url: "https://acme.com/login", selector: "#username" })
    ).concat(
      Array.from({ length: 25 }, () =>
        makeEntry({ url: "https://acme.com/products/123", selector: ".add-to-cart" })
      )
    );
    const result = aggregateBySite("acme.com", entries);
    expect(result.length).toBe(2);
    const patterns = result.map((c) => c.pathPattern).sort();
    expect(patterns).toContain("/login");
    expect(patterns).toContain("/products/*");
  });

  it("should only include entries for the given hostname", () => {
    const entries: BrowserTestEntry[] = [
      makeEntry({ hostname: "acme.com", url: "https://acme.com/login", selector: "#btn" }),
      makeEntry({ hostname: "other.com", url: "https://other.com/login", selector: "#btn" }),
    ];
    const result = aggregateBySite("acme.com", entries);
    expect(result).toHaveLength(1);
  });

  it("should group /products/456 and /products/789 into /products/*", () => {
    const entries: BrowserTestEntry[] = [
      makeEntry({ url: "https://acme.com/products/456", selector: ".title", confirmedAt: "2026-01-01T10:00:00Z" }),
      makeEntry({ url: "https://acme.com/products/789", selector: ".title", confirmedAt: "2026-01-02T10:00:00Z" }),
    ];
    const result = aggregateBySite("acme.com", entries);
    expect(result).toHaveLength(1);
    expect(result[0]?.pathPattern).toBe("/products/*");
  });
});

// ---------------------------------------------------------------------------
// AC2: positive — selector confirmed on ≥2 distinct dates
// ---------------------------------------------------------------------------

describe("aggregateBySite — AC2: positive when confirmed on ≥2 distinct dates", () => {
  it("should mark selector as positive when confirmed on 2+ distinct dates", () => {
    const entries: BrowserTestEntry[] = [
      makeEntry({ confirmedAt: "2026-01-01T10:00:00Z" }),
      makeEntry({ confirmedAt: "2026-01-02T10:00:00Z" }),
    ];
    const result = aggregateBySite("acme.com", entries);
    expect(result[0]?.positive).toBe(true);
  });

  it("should NOT mark as positive when confirmed on only 1 distinct date", () => {
    const entries: BrowserTestEntry[] = [
      makeEntry({ confirmedAt: "2026-01-01T10:00:00Z" }),
      makeEntry({ confirmedAt: "2026-01-01T15:00:00Z" }), // same date, different time
    ];
    const result = aggregateBySite("acme.com", entries);
    expect(result[0]?.positive).toBe(false);
  });

  it("should expose confirmedDates array", () => {
    const entries: BrowserTestEntry[] = [
      makeEntry({ confirmedAt: "2026-01-01T10:00:00Z" }),
      makeEntry({ confirmedAt: "2026-01-02T10:00:00Z" }),
    ];
    const result = aggregateBySite("acme.com", entries);
    expect(result[0]?.confirmedDates).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// AC3: negative — selector listed as trap in any run
// ---------------------------------------------------------------------------

describe("aggregateBySite — AC3: negative when selector is a trap", () => {
  it("should mark selector as negative when any entry has trap:true", () => {
    const entries: BrowserTestEntry[] = [
      makeEntry({ trap: false }),
      makeEntry({ trap: true }),
    ];
    const result = aggregateBySite("acme.com", entries);
    expect(result[0]?.negative).toBe(true);
  });

  it("should not mark as negative when no entry has trap:true", () => {
    const entries: BrowserTestEntry[] = [makeEntry({ trap: false })];
    const result = aggregateBySite("acme.com", entries);
    expect(result[0]?.negative).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC4: empty entries → returns []
// ---------------------------------------------------------------------------

describe("aggregateBySite — AC4: empty entries returns []", () => {
  it("should return empty array when no entries exist", () => {
    const result = aggregateBySite("acme.com", []);
    expect(result).toEqual([]);
  });

  it("should return empty array when all entries are for a different hostname", () => {
    const entries: BrowserTestEntry[] = [makeEntry({ hostname: "other.com" })];
    const result = aggregateBySite("acme.com", entries);
    expect(result).toEqual([]);
  });
});
