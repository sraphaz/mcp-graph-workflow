/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-PROXY — bearer token tests.
 */

import { describe, it, expect } from "vitest";
import {
  generateBearer,
  rotateBearer,
  isExpired,
  tokenMatches,
  BEARER_PREFIX,
  BEARER_BYTES,
  DEFAULT_TTL_MS,
} from "../core/proxy/bearer-token.js";

describe("bearer-token", () => {
  it("constants: prefix='mcpg_', bytes=32, default TTL=24h", () => {
    expect(BEARER_PREFIX).toBe("mcpg_");
    expect(BEARER_BYTES).toBe(32);
    expect(DEFAULT_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("generateBearer emits prefix + base64url payload", () => {
    const t = generateBearer(0);
    expect(t.token.startsWith(BEARER_PREFIX)).toBe(true);
    const payload = t.token.slice(BEARER_PREFIX.length);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(payload.length).toBeGreaterThanOrEqual(40);
  });

  it("generateBearer produces unique tokens across calls", () => {
    const a = generateBearer(0);
    const b = generateBearer(0);
    expect(a.token).not.toBe(b.token);
  });

  it("generateBearer with ttlMs sets expiresAtMs = createdAt + ttl", () => {
    const t = generateBearer(1000, 5000);
    expect(t.expiresAtMs).toBe(6000);
  });

  it("generateBearer without ttlMs leaves expiresAtMs undefined", () => {
    const t = generateBearer(1000);
    expect(t.expiresAtMs).toBeUndefined();
  });

  it("isExpired returns false when no expiry set", () => {
    const t = generateBearer(0);
    expect(isExpired(t, 999_999)).toBe(false);
  });

  it("isExpired returns true at or after expiresAtMs", () => {
    const t = generateBearer(0, 5000);
    expect(isExpired(t, 4999)).toBe(false);
    expect(isExpired(t, 5000)).toBe(true);
    expect(isExpired(t, 9999)).toBe(true);
  });

  describe("rotateBearer", () => {
    it("first rotation: active set, previous undefined", () => {
      const r = rotateBearer(undefined, 100);
      expect(r.active.createdAtMs).toBe(100);
      expect(r.previous).toBeUndefined();
    });

    it("subsequent rotation: old active moves to previous, new active generated", () => {
      const first = rotateBearer(undefined, 100);
      const second = rotateBearer(first, 200);
      expect(second.active.token).not.toBe(first.active.token);
      expect(second.active.createdAtMs).toBe(200);
      expect(second.previous?.token).toBe(first.active.token);
    });

    it("rotation drops the older 'previous' (grace window stays at 1)", () => {
      const a = rotateBearer(undefined, 1);
      const b = rotateBearer(a, 2);
      const c = rotateBearer(b, 3);
      expect(c.active.token).not.toBe(b.active.token);
      expect(c.previous?.token).toBe(b.active.token);
      // The original 'a' is no longer reachable.
      expect(tokenMatches(a.active.token, c)).toBe(false);
    });
  });

  describe("tokenMatches", () => {
    it("returns true for active token", () => {
      const store = rotateBearer(undefined);
      expect(tokenMatches(store.active.token, store)).toBe(true);
    });

    it("returns true for previous token (grace period)", () => {
      const a = rotateBearer(undefined, 1);
      const b = rotateBearer(a, 2);
      expect(tokenMatches(a.active.token, b)).toBe(true);
    });

    it("returns false for unrelated token", () => {
      const store = rotateBearer(undefined);
      expect(tokenMatches("mcpg_unrelated", store)).toBe(false);
    });

    it("returns false on empty input or undefined store", () => {
      expect(tokenMatches("", undefined)).toBe(false);
      expect(tokenMatches("", rotateBearer(undefined))).toBe(false);
      expect(tokenMatches("mcpg_x", undefined)).toBe(false);
    });
  });
});
