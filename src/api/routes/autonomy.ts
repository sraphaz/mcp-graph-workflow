/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Autonomy REST API — Observability endpoints for AAA+ pipeline
 *
 * M.A.P.A. pillar: A (Audit Quality Continuously)
 *
 * Endpoints:
 * - GET /status — autopilot state + harness score
 * - GET /session — current autopilot session details
 * - GET /budget — adaptive token budget distribution
 */

import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { getAdaptiveBudgetSplit } from "../../core/context/adaptive-budget.js";
import { runHarnessScanCached } from "../../core/harness/harness-cache.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "api", source: "autonomy.ts" });

/** createAutonomyRouter — auto-generated description placeholder. */
export function createAutonomyRouter(storeRef: StoreRef): Router {
  const router = Router();

  /**
   * GET /api/autonomy/status
   * Returns autopilot active state, harness score, and pipeline readiness.
   */
  router.get("/status", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const autopilotActive = store.getProjectSetting("autopilot_active") === "true";
      const testGateMode = store.getProjectSetting("test_gate_mode") ?? "advisory";
      const contractGateMode = store.getProjectSetting("contract_gate_mode") ?? "advisory";
      const phase = store.getProjectSetting("lifecycle_phase_override") ?? "auto";

      let harnessScore = 0;
      let harnessGrade = "D";
      try {
        const harness = runHarnessScanCached(process.cwd());
        if (harness) {
          harnessScore = harness.score;
          harnessGrade = harness.grade;
        }
      } catch {
        // Harness scan may fail in test environments
      }

      res.json({
        autopilotActive,
        phase,
        harnessScore,
        harnessGrade,
        gates: {
          testGate: testGateMode,
          contractGate: contractGateMode,
        },
        pipeline: {
          testGateWired: true,
          contractGateWired: true,
          prefetcherWired: true,
          adaptiveBudgetWired: true,
          astPruningWired: true,
          citationsWired: true,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/autonomy/session
   * Returns current autopilot session details (if active).
   */
  router.get("/session", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();

      const session = db.prepare(
        `SELECT * FROM autopilot_sessions WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`,
      ).get() as Record<string, unknown> | undefined;

      if (!session) {
        res.json({ active: false, session: null });
        return;
      }

      res.json({
        active: true,
        session: {
          id: session.id,
          sprintId: session.sprint_id,
          startedAt: session.started_at,
          status: session.status,
          tasksCompleted: session.tasks_completed,
          tasksFailed: session.tasks_failed,
          tokensUsed: session.tokens_used,
          config: JSON.parse((session.config as string) ?? "{}"),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/autonomy/budget
   * Returns current adaptive token budget distribution.
   */
  router.get("/budget", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const phase = store.getProjectSetting("lifecycle_phase_override") ?? "IMPLEMENT";

      const split = getAdaptiveBudgetSplit(4000, store.getDb(), phase, "B");

      // Get Q-Learning stats
      let policyStats = { totalVisits: 0, convergenceRate: 0 };
      try {
        const rows = store.getDb().prepare(
          `SELECT SUM(visits) as total, COUNT(CASE WHEN visits > 0 THEN 1 END) as nonzero, COUNT(*) as entries
           FROM token_budget_policy`,
        ).get() as { total: number; nonzero: number; entries: number } | undefined;

        if (rows) {
          policyStats = {
            totalVisits: rows.total ?? 0,
            convergenceRate: rows.entries > 0 ? (rows.nonzero ?? 0) / rows.entries : 0,
          };
        }
      } catch {
        // Table may not exist in test environments
      }

      res.json({
        phase,
        distribution: {
          graph: split.graphBudget,
          knowledge: split.knowledgeBudget,
          code: split.codeBudget,
          history: split.historyBudget,
        },
        preset: split.preset,
        source: split.source,
        qLearning: policyStats,
      });
    } catch (err) {
      next(err);
    }
  });

  log.debug("api:autonomy:registered", { endpoints: ["/status", "/session", "/budget"] });
  return router;
}
