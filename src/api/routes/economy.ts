/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T13 — REST routes for the Token Economy subsystem.
 *
 * Endpoints:
 *   GET  /stats           — cache size + booster registry summary
 *   POST /cache/clear     — invalidate response cache (returns count cleared)
 *   GET  /router/explain  — TierDispatch for given tier + tokenBudget
 *   POST /booster/run     — run a named booster against supplied source
 */

import { Router } from "express";
import { z } from "zod/v4";
import { dispatchTier } from "../../core/llm/tier-router.js";
import type { Tier } from "../../core/llm/complexity-classifier.js";
import { varToConst } from "../../core/llm/boosters/var-to-const.js";
import { addTypes } from "../../core/llm/boosters/add-types.js";
import { asyncAwait } from "../../core/llm/boosters/async-await.js";
import { addErrorHandling } from "../../core/llm/boosters/add-error-handling.js";
import { addLogging } from "../../core/llm/boosters/add-logging.js";
import { removeConsole } from "../../core/llm/boosters/remove-console.js";

export interface EconomyApiCacheRef {
  size(): number;
  invalidateAll(): number;
}

export interface EconomyRouterDeps {
  cache: EconomyApiCacheRef;
}

const BOOSTER_REGISTRY: Record<string, (s: string) => { output: string }> = {
  "var-to-const": (s) => varToConst(s),
  "add-types": (s) => addTypes(s),
  "async-await": (s) => asyncAwait(s),
  "add-error-handling": (s) => addErrorHandling(s),
  "add-logging": (s) => addLogging(s),
  "remove-console": (s) => removeConsole(s),
};

const BOOSTER_NAMES = Object.keys(BOOSTER_REGISTRY);

const RouterExplainQuery = z.object({
  tier: z.enum(["tier0", "tier1", "tier2"]),
  tokenBudget: z.coerce.number().int().nonnegative().optional(),
});

const BoosterRunBody = z.object({
  boosterName: z.string().min(1),
  source: z.string(),
});

/** createEconomyRouter — auto-generated description placeholder. */
export function createEconomyRouter(deps: EconomyRouterDeps): Router {
  const router = Router();

  router.get("/stats", (_req, res) => {
    res.json({
      cache: { size: deps.cache.size() },
      boosters: { count: BOOSTER_NAMES.length, names: BOOSTER_NAMES },
    });
  });

  router.post("/cache/clear", (_req, res) => {
    const cleared = deps.cache.invalidateAll();
    res.json({ cleared });
  });

  router.get("/router/explain", (req, res) => {
    const parsed = RouterExplainQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid query", details: z.treeifyError(parsed.error) });
      return;
    }
    const dispatch = dispatchTier({
      tier: parsed.data.tier as Tier,
      tokenBudget: parsed.data.tokenBudget,
    });
    res.json(dispatch);
  });

  router.post("/booster/run", (req, res) => {
    const parsed = BoosterRunBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body", details: z.treeifyError(parsed.error) });
      return;
    }
    const fn = BOOSTER_REGISTRY[parsed.data.boosterName];
    if (!fn) {
      res
        .status(404)
        .json({ error: `unknown booster '${parsed.data.boosterName}'`, known: BOOSTER_NAMES });
      return;
    }
    const resultValue = fn(parsed.data.source);
    res.json({ booster: parsed.data.boosterName, output: resultValue.output });
  });

  return router;
}
