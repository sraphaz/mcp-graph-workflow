/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-18.AC6 — REST surface for the eval-driven harness dashboard.
 *
 *   GET /api/evals/summary?trendDays=30&topFailingLimit=10
 *     → totalRuns, totalGoldens, passRate, totalCostUsd, trend[], topFailing[]
 *
 * Pure read path — no mutation, safe to cache aggressively at the client.
 */

import { Router } from "express";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { computeEvalsSummary } from "../../core/evals/evals-summary.js";

const SummaryQuery = z.object({
  trendDays: z.coerce.number().int().positive().max(365).optional(),
  topFailingLimit: z.coerce.number().int().positive().max(100).optional(),
});

export function createEvalsRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/summary", (req, res, next) => {
    try {
      const parsed = SummaryQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid query", details: z.treeifyError(parsed.error) });
        return;
      }
      const summary = computeEvalsSummary(storeRef.current.getDb(), parsed.data);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
