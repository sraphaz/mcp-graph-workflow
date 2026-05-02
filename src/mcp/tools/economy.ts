/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T12 — MCP tool `economy`.
 *
 * Surface for the Token Economy subsystem (response cache, tier router,
 * booster registry). Read-only actions (stats, router_explain) bypass the
 * unified-gate; mutating actions (cache_clear, booster_run) go through it.
 */

import { z } from "zod/v4";
import { mcpError, mcpText, type McpToolResponse } from "../response-helpers.js";
import { dispatchTier } from "../../core/llm/tier-router.js";
import type { Tier } from "../../core/llm/complexity-classifier.js";
import { varToConst } from "../../core/llm/boosters/var-to-const.js";
import { addTypes } from "../../core/llm/boosters/add-types.js";
import { asyncAwait } from "../../core/llm/boosters/async-await.js";
import { addErrorHandling } from "../../core/llm/boosters/add-error-handling.js";
import { addLogging } from "../../core/llm/boosters/add-logging.js";
import { removeConsole } from "../../core/llm/boosters/remove-console.js";

export const economyInputSchema = z.object({
  action: z.enum(["stats", "cache_clear", "router_explain", "booster_run"]),
  tier: z.enum(["tier0", "tier1", "tier2"]).optional(),
  tokenBudget: z.number().int().nonnegative().optional(),
  boosterName: z.string().optional(),
  source: z.string().optional(),
});

export type EconomyToolInput = z.infer<typeof economyInputSchema>;

export const ECONOMY_READ_ONLY_ACTIONS: ReadonlySet<EconomyToolInput["action"]> =
  new Set(["stats", "router_explain"]);

export interface EconomyCacheRef {
  size(): number;
  /** Clear cache; returns the number of entries that were cleared. */
  invalidateAll(): number;
}

export interface EconomyToolDeps {
  cache: EconomyCacheRef;
  boosterNames: string[];
}

type BoosterFn = (source: string) => { output: string };

const BOOSTER_REGISTRY: Record<string, BoosterFn> = {
  "var-to-const": (s) => varToConst(s),
  "add-types": (s) => addTypes(s),
  "async-await": (s) => asyncAwait(s),
  "add-error-handling": (s) => addErrorHandling(s),
  "add-logging": (s) => addLogging(s),
  "remove-console": (s) => removeConsole(s),
};

/** buildEconomyHandler — auto-generated description placeholder. */
export function buildEconomyHandler(
  deps: EconomyToolDeps,
): (params: EconomyToolInput) => Promise<McpToolResponse> {
  return async (params) => {
    switch (params.action) {
      case "stats":
        return handleStats(deps);
      case "cache_clear":
        return handleCacheClear(deps);
      case "router_explain":
        return handleRouterExplain(params);
      case "booster_run":
        return handleBoosterRun(params);
    }
  };
}

function handleStats(deps: EconomyToolDeps): McpToolResponse {
  const dataValue = {
    cache: { size: deps.cache.size() },
    boosters: { count: deps.boosterNames.length, names: deps.boosterNames },
  };
  return { ...mcpText(dataValue), structuredContent: dataValue };
}

function handleCacheClear(deps: EconomyToolDeps): McpToolResponse {
  const cleared = deps.cache.invalidateAll();
  const dataValue = { cleared };
  return { ...mcpText(dataValue), structuredContent: dataValue };
}

function handleRouterExplain(params: EconomyToolInput): McpToolResponse {
  if (!params.tier) {
    return mcpError("economy.router_explain: tier is required");
  }
  const dispatch = dispatchTier({
    tier: params.tier as Tier,
    tokenBudget: params.tokenBudget,
  });
  return { ...mcpText(dispatch), structuredContent: dispatch };
}

function handleBoosterRun(params: EconomyToolInput): McpToolResponse {
  if (!params.boosterName) {
    return mcpError("economy.booster_run: boosterName is required");
  }
  if (params.source === undefined) {
    return mcpError("economy.booster_run: source is required");
  }
  const fn = BOOSTER_REGISTRY[params.boosterName];
  if (!fn) {
    return mcpError(
      `economy.booster_run: unknown booster '${params.boosterName}' — known: ${Object.keys(BOOSTER_REGISTRY).join(", ")}`,
    );
  }
  const resultValue = fn(params.source);
  const dataValue = { booster: params.boosterName, output: resultValue.output };
  return { ...mcpText(dataValue), structuredContent: dataValue };
}
