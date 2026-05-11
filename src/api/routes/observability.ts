/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-observability — Task 3.1: GET /api/observability/metrics
 *
 * Query de alto nível sobre a tabela `events`: tool calls/min, p50/p95 por kind,
 * sessions ativas, taxa de erro. Retorna estrutura vazia explícita quando sem dados.
 */

import { Router } from "express";
import { z } from "zod/v4";
import type Database from "better-sqlite3";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "api", source: "observability.ts" });

const WINDOW_PRESETS: Record<string, number> = {
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
};

const MetricsQuerySchema = z.object({
  window: z.string().optional(),
});

interface KindMetrics {
  count: number;
  p50: number;
  p95: number;
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = p * sorted.length - 1;
  const lo = Math.max(0, Math.floor(rank));
  const hi = Math.min(Math.ceil(rank), sorted.length - 1);
  // Indices are bounded by Math.max/Math.min above — non-null is safe
  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? 0;
  return Math.round(loVal + (rank - lo) * (hiVal - loVal));
}

function buildMetrics(db: Database.Database, windowMs: number) {
  const since = new Date(Date.now() - windowMs).toISOString();

  const rows = db.prepare(
    "SELECT kind, sessionId, durationMs FROM events WHERE timestamp >= ? ORDER BY durationMs ASC",
  ).all(since) as Array<{ kind: string; sessionId: string | null; durationMs: number | null }>;

  const byKind: Record<string, KindMetrics> = {};
  const sessionSet = new Set<string>();

  for (const row of rows) {
    if (row.sessionId) sessionSet.add(row.sessionId);

    if (!byKind[row.kind]) byKind[row.kind] = { count: 0, p50: 0, p95: 0 };
    (byKind[row.kind] as KindMetrics).count++;
  }

  // Compute p50/p95 per kind
  for (const kind of Object.keys(byKind)) {
    const durations = rows
      .filter((r) => r.kind === kind && r.durationMs !== null)
      .map((r) => r.durationMs as number)
      .sort((a, b) => a - b);
    (byKind[kind] as KindMetrics).p50 = pct(durations, 0.5);
    (byKind[kind] as KindMetrics).p95 = pct(durations, 0.95);
  }

  const durationMs = windowMs;
  const totalCalls = rows.length;
  const callsPerMin = durationMs > 0 ? Math.round((totalCalls / durationMs) * 60_000 * 100) / 100 : 0;

  return {
    windowMs,
    callsPerMin,
    byKind,
    activeSessions: [...sessionSet],
  };
}

export function createObservabilityRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/metrics", (req, res, next) => {
    try {
      const parsed = MetricsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_query", details: parsed.error.issues });
        return;
      }

      const windowParam = parsed.data.window ?? "1h";
      const windowMs = WINDOW_PRESETS[windowParam];
      if (windowMs === undefined) {
        res.status(400).json({ error: "invalid_window", validValues: Object.keys(WINDOW_PRESETS) });
        return;
      }

      const metrics = buildMetrics(db, windowMs);
      log.debug("observability:metrics", { windowMs, callsPerMin: metrics.callsPerMin });
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
