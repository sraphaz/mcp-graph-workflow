/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  CACHEABLE_TOOLS,
  type CacheableToolName,
} from "../core/economy/_cacheable-tools.js";
import {
  CacheKeySchema,
  EconomyStatsSchema,
  EconomyTierSchema,
  type CacheKey,
  type EconomyStats,
} from "../core/economy/economy-types.js";

describe("_cacheable-tools", () => {
  it("CACHEABLE_TOOLS is a non-empty Set", () => {
    expect(CACHEABLE_TOOLS.size).toBeGreaterThan(0);
  });

  it("only contains read-only tool names (no mutating tools)", () => {
    const KNOWN_MUTATING = ["node", "edge", "update_status", "import_prd", "delete_memory", "set_phase"];
    for (const tool of KNOWN_MUTATING) {
      expect(CACHEABLE_TOOLS.has(tool as CacheableToolName)).toBe(false);
    }
  });

  it("contains expected read-only tools", () => {
    expect(CACHEABLE_TOOLS.has("list")).toBe(true);
    expect(CACHEABLE_TOOLS.has("show")).toBe(true);
    expect(CACHEABLE_TOOLS.has("search")).toBe(true);
    expect(CACHEABLE_TOOLS.has("analyze")).toBe(true);
  });
});

describe("economy-types Zod schemas", () => {
  it("CacheKeySchema validates a valid cache key", () => {
    const key: CacheKey = {
      toolName: "analyze",
      argsHash: "abc123",
      schemaVersion: 1,
      model: "claude-opus-4-7",
    };
    expect(CacheKeySchema.safeParse(key).success).toBe(true);
  });

  it("CacheKeySchema rejects missing toolName", () => {
    expect(CacheKeySchema.safeParse({ argsHash: "abc", schemaVersion: 1 }).success).toBe(false);
  });

  it("EconomyTierSchema validates tier values 0, 1, 2", () => {
    expect(EconomyTierSchema.safeParse(0).success).toBe(true);
    expect(EconomyTierSchema.safeParse(1).success).toBe(true);
    expect(EconomyTierSchema.safeParse(2).success).toBe(true);
    expect(EconomyTierSchema.safeParse(3).success).toBe(false);
  });

  it("EconomyStatsSchema validates a stats record", () => {
    const stats: EconomyStats = {
      tokensSavedTotal: 1000,
      costSavedUsd: 0.05,
      cacheHitRate: 0.6,
      boosterHitRate: 0.3,
      tierDistribution: { tier0: 10, tier1: 50, tier2: 40 },
      avgLatencyPerTierMs: { tier0: 0.5, tier1: 400, tier2: 2500 },
    };
    expect(EconomyStatsSchema.safeParse(stats).success).toBe(true);
  });
});
