/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T09 — tier-router tests.
 */

import { describe, it, expect } from "vitest";
import {
  dispatchTier,
  pickTier1Model,
  HAIKU,
  SONNET,
  OPUS,
  SONNET_MIN_TOKENS,
} from "../core/llm/tier-router.js";

describe("tier-router (E6.T09)", () => {
  it("model names and SONNET_MIN_TOKENS constants", () => {
    expect(HAIKU).toBe("haiku");
    expect(SONNET).toBe("sonnet");
    expect(OPUS).toBe("opus");
    expect(SONNET_MIN_TOKENS).toBe(8000);
  });

  describe("pickTier1Model", () => {
    it("returns haiku for small/missing budget", () => {
      expect(pickTier1Model(undefined)).toBe("haiku");
      expect(pickTier1Model(0)).toBe("haiku");
      expect(pickTier1Model(2000)).toBe("haiku");
    });

    it("returns sonnet for budget >= SONNET_MIN_TOKENS", () => {
      expect(pickTier1Model(8000)).toBe("sonnet");
      expect(pickTier1Model(50000)).toBe("sonnet");
    });
  });

  describe("Tier 0", () => {
    it("returns booster output on hit (no LLM model)", () => {
      const r = dispatchTier({
        tier: "tier0",
        booster: () => ({ hit: true, output: "BOOSTED", reason: "regex-match" }),
      });
      expect(r.tier).toBe("tier0");
      expect(r.model).toBeNull();
      expect(r.boosterOutput).toBe("BOOSTED");
      expect(r.reason).toBe("regex-match");
    });

    it("escalates to tier1 on booster miss", () => {
      const r = dispatchTier({
        tier: "tier0",
        tokenBudget: 1000,
        booster: () => ({ hit: false, reason: "no-pattern-match" }),
      });
      expect(r.tier).toBe("tier1");
      expect(r.model).toBe("haiku");
      expect(r.reason).toContain("tier1");
    });

    it("missing booster on tier0 → no-booster reason, no model", () => {
      const r = dispatchTier({ tier: "tier0" });
      expect(r.tier).toBe("tier0");
      expect(r.model).toBeNull();
      expect(r.reason).toBe("tier0-no-booster");
    });
  });

  describe("Tier 1", () => {
    it("picks haiku for small budget", () => {
      const r = dispatchTier({ tier: "tier1", tokenBudget: 2000 });
      expect(r.tier).toBe("tier1");
      expect(r.model).toBe("haiku");
    });

    it("picks sonnet for medium budget", () => {
      const r = dispatchTier({ tier: "tier1", tokenBudget: 16000 });
      expect(r.model).toBe("sonnet");
    });
  });

  describe("Tier 2", () => {
    it("always returns opus", () => {
      expect(dispatchTier({ tier: "tier2" }).model).toBe("opus");
      expect(dispatchTier({ tier: "tier2", tokenBudget: 100 }).model).toBe("opus");
      expect(dispatchTier({ tier: "tier2", tokenBudget: 100000 }).model).toBe("opus");
    });
  });
});
