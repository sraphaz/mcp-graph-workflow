/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T12 — economy MCP tool tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildEconomyHandler,
  ECONOMY_READ_ONLY_ACTIONS,
  type EconomyToolDeps,
} from "../mcp/tools/economy.js";
import { READ_ONLY_TOOLS } from "../core/utils/constants.js";

function makeDeps(overrides: Partial<EconomyToolDeps> = {}): EconomyToolDeps {
  let cacheSize = 5;
  return {
    cache: {
      size: () => cacheSize,
      invalidateAll: () => {
        const prev = cacheSize;
        cacheSize = 0;
        return prev;
      },
    },
    boosterNames: ["var-to-const", "add-types", "async-await"],
    ...overrides,
  };
}

describe("economy MCP tool (E6.T12)", () => {
  describe("read-only allowlist", () => {
    it("ECONOMY_READ_ONLY_ACTIONS contains stats and router_explain", () => {
      expect(ECONOMY_READ_ONLY_ACTIONS.has("stats")).toBe(true);
      expect(ECONOMY_READ_ONLY_ACTIONS.has("router_explain")).toBe(true);
    });

    it("does NOT contain cache_clear or booster_run (those are mutating)", () => {
      expect(ECONOMY_READ_ONLY_ACTIONS.has("cache_clear")).toBe(false);
      expect(ECONOMY_READ_ONLY_ACTIONS.has("booster_run")).toBe(false);
    });

    it("'economy' tool is in the global READ_ONLY_TOOLS allowlist (so stats/explain don't trip the gate)", () => {
      expect(READ_ONLY_TOOLS.has("economy")).toBe(true);
    });
  });

  describe("stats action", () => {
    it("returns cache size and registered booster count", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({ action: "stats" });
      expect(r.isError).toBeFalsy();
      expect(r.structuredContent).toMatchObject({
        cache: { size: 5 },
        boosters: { count: 3 },
      });
    });
  });

  describe("cache_clear action", () => {
    it("invalidates the cache and returns count cleared", async () => {
      const deps = makeDeps();
      const handler = buildEconomyHandler(deps);
      const r = await handler({ action: "cache_clear" });
      expect(r.isError).toBeFalsy();
      expect(r.structuredContent).toMatchObject({ cleared: 5 });
      // subsequent stats reflect the clear
      const after = await handler({ action: "stats" });
      expect(after.structuredContent).toMatchObject({ cache: { size: 0 } });
    });
  });

  describe("router_explain action", () => {
    it("tier1 with small budget → haiku", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({
        action: "router_explain",
        tier: "tier1",
        tokenBudget: 1000,
      });
      expect(r.structuredContent).toMatchObject({ tier: "tier1", model: "haiku" });
    });

    it("tier1 with large budget → sonnet", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({
        action: "router_explain",
        tier: "tier1",
        tokenBudget: 16000,
      });
      expect(r.structuredContent).toMatchObject({ model: "sonnet" });
    });

    it("tier2 → opus", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({ action: "router_explain", tier: "tier2" });
      expect(r.structuredContent).toMatchObject({ model: "opus" });
    });

    it("rejects when tier is missing", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({ action: "router_explain" });
      expect(r.isError).toBe(true);
    });
  });

  describe("booster_run action", () => {
    it("runs the named booster against the supplied source", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({
        action: "booster_run",
        boosterName: "var-to-const",
        source: `var x = 1;\nconsole.log(x);`,
      });
      expect(r.isError).toBeFalsy();
      const sc = r.structuredContent as { booster: string; output: string };
      expect(sc.booster).toBe("var-to-const");
      expect(sc.output).toContain("const x = 1");
    });

    it("rejects when boosterName is unknown", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({
        action: "booster_run",
        boosterName: "no-such-booster",
        source: "var x = 1;",
      });
      expect(r.isError).toBe(true);
    });

    it("rejects when source is missing", async () => {
      const handler = buildEconomyHandler(makeDeps());
      const r = await handler({ action: "booster_run", boosterName: "var-to-const" });
      expect(r.isError).toBe(true);
    });
  });
});
