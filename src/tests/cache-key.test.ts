/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { buildCacheKey, canonicalJson } from "../core/economy/cache/cache-key.js";

describe("canonicalJson", () => {
  it("sorts object keys alphabetically", () => {
    const a = canonicalJson({ z: 1, a: 2, m: 3 });
    const b = canonicalJson({ m: 3, z: 1, a: 2 });
    expect(a).toBe(b);
    expect(a).toMatch(/"a":2.*"m":3.*"z":1/s);
  });

  it("sorts keys recursively in nested objects", () => {
    const a = canonicalJson({ b: { y: 1, x: 2 }, a: 0 });
    const b = canonicalJson({ a: 0, b: { x: 2, y: 1 } });
    expect(a).toBe(b);
  });

  it("preserves arrays as-is (order matters)", () => {
    const a = canonicalJson([3, 1, 2]);
    const b = canonicalJson([1, 2, 3]);
    expect(a).not.toBe(b);
  });

  it("handles null, number, string, boolean primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("hi")).toBe('"hi"');
    expect(canonicalJson(true)).toBe("true");
  });
});

describe("buildCacheKey", () => {
  const base = { toolName: "analyze", args: { mode: "sprint_health" }, schemaVersion: 1 };

  it("returns a hex string of length 64 (sha256)", () => {
    const key = buildCacheKey(base);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same inputs yield same key (deterministic)", () => {
    expect(buildCacheKey(base)).toBe(buildCacheKey({ ...base }));
  });

  it("different args produce different keys", () => {
    const k1 = buildCacheKey(base);
    const k2 = buildCacheKey({ ...base, args: { mode: "harness_scan" } });
    expect(k1).not.toBe(k2);
  });

  it("arg key order does not affect key (canonical sorting)", () => {
    const k1 = buildCacheKey({ ...base, args: { b: 2, a: 1 } });
    const k2 = buildCacheKey({ ...base, args: { a: 1, b: 2 } });
    expect(k1).toBe(k2);
  });

  it("schemaVersion bump produces a different key", () => {
    const k1 = buildCacheKey(base);
    const k2 = buildCacheKey({ ...base, schemaVersion: 2 });
    expect(k1).not.toBe(k2);
  });

  it("model field is included in key when provided", () => {
    const k1 = buildCacheKey({ ...base, model: "claude-haiku-4-5" });
    const k2 = buildCacheKey({ ...base, model: "claude-opus-4-7" });
    expect(k1).not.toBe(k2);
  });

  it("absent model vs provided model yield different keys", () => {
    const k1 = buildCacheKey(base);
    const k2 = buildCacheKey({ ...base, model: "claude-haiku-4-5" });
    expect(k1).not.toBe(k2);
  });
});
