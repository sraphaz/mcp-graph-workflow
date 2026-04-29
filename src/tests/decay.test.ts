/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-5.T03 — decay tests.
 */

import { describe, it, expect } from "vitest";
import {
  ebbinghausWeight,
  weightAt,
  halfLifeMs,
  tauFromConstitution,
  DEFAULT_TAU_DAYS,
  DEFAULT_TAU_MS,
} from "../core/learning/decay.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("decay (E5.T03)", () => {
  it("DEFAULT_TAU_DAYS = 30 days", () => {
    expect(DEFAULT_TAU_DAYS).toBe(30);
    expect(DEFAULT_TAU_MS).toBe(30 * DAY_MS);
  });

  it("ebbinghausWeight(0) = 1", () => {
    expect(ebbinghausWeight(0)).toBe(1);
  });

  it("ebbinghausWeight(τ) ≈ 1/e ≈ 0.3679", () => {
    expect(ebbinghausWeight(DEFAULT_TAU_MS)).toBeCloseTo(1 / Math.E, 3);
  });

  it("monotonically decreasing as age grows", () => {
    const a = ebbinghausWeight(DAY_MS);
    const b = ebbinghausWeight(7 * DAY_MS);
    const c = ebbinghausWeight(60 * DAY_MS);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("custom τ honored", () => {
    const tau = 7 * DAY_MS;
    expect(ebbinghausWeight(tau, { tauMs: tau })).toBeCloseTo(1 / Math.E, 3);
  });

  it("negative age clamps to 1 (event not yet observed treated as fresh)", () => {
    expect(ebbinghausWeight(-100)).toBe(1);
  });

  it("floor option clamps tiny weights to 0", () => {
    const w = ebbinghausWeight(365 * DAY_MS);
    expect(w).toBeGreaterThan(0);
    expect(ebbinghausWeight(365 * DAY_MS, { floor: 0.01 })).toBe(0);
  });

  it("weightAt computes age relative to now", () => {
    const observed = 100;
    const now = 100 + DEFAULT_TAU_MS;
    expect(weightAt(observed, now)).toBeCloseTo(1 / Math.E, 3);
  });

  it("weightAt: future timestamps return weight 1 (clamped age 0)", () => {
    expect(weightAt(2000, 1000)).toBe(1);
  });

  it("halfLifeMs = τ * ln(2)", () => {
    expect(halfLifeMs()).toBeCloseTo(DEFAULT_TAU_MS * Math.LN2);
  });

  describe("tauFromConstitution", () => {
    it("returns DEFAULT_TAU_MS when no constitution", () => {
      expect(tauFromConstitution(undefined)).toBe(DEFAULT_TAU_MS);
      expect(tauFromConstitution({})).toBe(DEFAULT_TAU_MS);
    });

    it("reads learning.decay_tau_days when set", () => {
      expect(tauFromConstitution({ "learning.decay_tau_days": 7 })).toBe(7 * DAY_MS);
    });

    it("ignores invalid values, falls back to default", () => {
      expect(tauFromConstitution({ "learning.decay_tau_days": -1 })).toBe(DEFAULT_TAU_MS);
      expect(tauFromConstitution({ "learning.decay_tau_days": 0 })).toBe(DEFAULT_TAU_MS);
      expect(tauFromConstitution({ "learning.decay_tau_days": "7" })).toBe(DEFAULT_TAU_MS);
    });
  });
});
