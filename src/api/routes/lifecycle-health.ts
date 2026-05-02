/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintF — Lifecycle Health API routes.
 *
 * Three endpoints:
 *   GET /api/lifecycle-health/snapshots[?epicId=]   → list raw snapshots
 *   GET /api/lifecycle-health/trend[?window=10]    → success-rate trend
 *   GET /api/lifecycle-health/:epicId              → compute fresh report
 */

import { Router } from "express";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { computePrdLifecycleHealth } from "../../core/analyzer/prd-lifecycle-health.js";
import { computeCapacityHealth } from "../../core/analyzer/capacity-health.js";
import { sweepStaleDecisions } from "../../core/autonomy/listening-sweep.js";
import {
  recordSnapshot,
  computeSuccessRate,
} from "../../core/analyzer/lifecycle-health-snapshots.js";
import { logger } from "../../core/utils/logger.js";

const TrendQuerySchema = z.object({
  window: z.coerce.number().int().positive().max(100).optional(),
  epicId: z.string().optional(),
});

const SnapshotsQuerySchema = z.object({
  epicId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

interface SnapshotRow {
  id: string;
  epic_id: string | null;
  snapshot_json: string;
  passed_all: number;
  taken_at: string;
  taken_on: string;
}

/** createLifecycleHealthRouter — auto-generated description placeholder. */
export function createLifecycleHealthRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/trend", (req, res, next) => {
    try {
      const parsed = TrendQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_query", details: parsed.error.issues });
        return;
      }
      const { window, epicId } = parsed.data;
      const resultValue = computeSuccessRate(storeRef.current.getDb(), {
        window: window ?? 10,
        epicId: epicId ?? null,
      });
      res.json(resultValue);
    } catch (err) {
      next(err);
    }
  });

  router.get("/snapshots", (req, res, next) => {
    try {
      const parsed = SnapshotsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_query", details: parsed.error.issues });
        return;
      }
      const { epicId, limit } = parsed.data;
      const db = storeRef.current.getDb();
      const rows =
        epicId !== undefined
          ? (db
              .prepare(
                `SELECT id, epic_id, snapshot_json, passed_all, taken_at, taken_on
                 FROM lifecycle_health_snapshots WHERE epic_id = ?
                 ORDER BY taken_at DESC LIMIT ?`,
              )
              .all(epicId, limit ?? 30) as SnapshotRow[])
          : (db
              .prepare(
                `SELECT id, epic_id, snapshot_json, passed_all, taken_at, taken_on
                 FROM lifecycle_health_snapshots
                 ORDER BY taken_at DESC LIMIT ?`,
              )
              .all(limit ?? 30) as SnapshotRow[]);
      res.json({
        snapshots: rows.map((r) => ({
          id: r.id,
          epicId: r.epic_id,
          passedAll: r.passed_all === 1,
          takenAt: r.taken_at,
          takenOn: r.taken_on,
          report: safeJson(r.snapshot_json),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // §SprintF — Compute a fresh report. Persists a snapshot as a side
  // effect so the dashboard tab and analyze(success_rate) stay in sync.
  router.get("/:epicId", (req, res, next) => {
    try {
      const epicId = req.params["epicId"];
      if (!epicId || epicId === "trend" || epicId === "snapshots") {
        res.status(400).json({ error: "invalid_epicId" });
        return;
      }
      const store = storeRef.current;
      const doc = store.toGraphDocument();
      const epic = doc.nodes.find((n) => n.id === epicId);
      if (!epic) {
        res.status(404).json({ error: "epic_not_found", epicId });
        return;
      }
      const cap = computeCapacityHealth(doc);
      const sweep = sweepStaleDecisions(store.getDb());
      const report = computePrdLifecycleHealth(doc, epicId, {
        capacityCalibrationDelta: cap.deltaPct,
        decisionOutcomeClosureRate: sweep.closureRate,
      });
      try {
        recordSnapshot(store.getDb(), report);
      } catch (err) {
        logger.warn("api:lifecycle-health:snapshot_failed", { error: String(err) });
      }
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
