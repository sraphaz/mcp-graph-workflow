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
 * Harness API Routes — REST endpoints for harness score, trend, and advice.
 * Used by the dashboard and external tools.
 */

import { Router } from "express";
import { logger } from "../../core/utils/logger.js";
import type { StoreRef } from "../../core/store/store-manager.js";
import { runHarnessScanCached } from "../../core/harness/harness-cache.js";
import { runHarnessScan } from "../../core/harness/harness-scan-runner.js";
import { IssuePatternTracker } from "../../core/harness/issue-pattern-tracker.js";
import { detectCurrentPhase } from "../../core/planner/lifecycle-phase.js";
import { evaluate as evaluateRemediations } from "../../core/harness/remediation-engine.js";
import { SuppressionStore } from "../../core/harness/remediation-suppression.js";

/** createHarnessRouter — auto-generated description placeholder. */
export function createHarnessRouter(storeRef: StoreRef): Router {
  const router = Router();

  /**
   * GET /api/harness/score — current harness scan result
   */
  router.get("/score", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();
      const resultValue = runHarnessScan(process.cwd(), db);

      let currentPhase: string = "ANALYZE";
      try {
        const doc = store.toGraphDocument();
        currentPhase = detectCurrentPhase(doc);
      } catch {
        // graph may be empty — default to ANALYZE
      }

      res.json({
        ok: true,
        score: resultValue.score,
        grade: resultValue.grade,
        breakdown: resultValue.breakdown,
        details: resultValue.details,
        timestamp: resultValue.timestamp,
        ruleSuggestions: resultValue.ruleSuggestions,
        currentPhase,
      });
    } catch (err) {
      logger.error("api:harness:score:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/trend — last 10 snapshots with trend direction
   */
  router.get("/trend", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();
      const project = store.getActiveProject();
      const projectId = project?.id ?? "default";

      const rows = db
        .prepare(
          "SELECT score, grade, breakdown, git_commit, timestamp FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 10",
        )
        .all(projectId) as Array<{
          score: number;
          grade: string;
          breakdown: string;
          git_commit: string | null;
          timestamp: string;
        }>;

      const history = rows.reverse().map((r) => ({
        score: r.score,
        grade: r.grade,
        timestamp: r.timestamp,
        gitCommit: r.git_commit,
      }));

      if (history.length === 0) {
        res.json({ ok: true, history: [], trend: "no_data", delta: 0 });
        return;
      }

      const first = history[0].score;
      const last = history[history.length - 1].score;
      const delta = Math.round((last - first) * 10) / 10;
      const absDelta = Math.abs(delta);

      let trend: "improving" | "degrading" | "stable" | "no_data";
      if (absDelta < 2) trend = "stable";
      else if (delta > 0) trend = "improving";
      else trend = "degrading";

      res.json({ ok: true, history, trend, delta });
    } catch (err) {
      logger.error("api:harness:trend:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/history — harness scan history with optional limit
   * Query params: limit (1-100, default 30)
   */
  router.get("/history", (req, res, next) => {
    try {
      const limitParam = Number(req.query.limit ?? 30);
      if (isNaN(limitParam) || limitParam < 1 || limitParam > 100) {
        res.status(400).json({ ok: false, error: "limit must be between 1 and 100" });
        return;
      }
      const limit = Math.floor(limitParam);

      const store = storeRef.current;
      const db = store.getDb();
      const project = store.getActiveProject();
      const projectId = project?.id ?? "default";

      const rows = db
        .prepare(
          "SELECT score, grade, breakdown, git_commit, timestamp FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?",
        )
        .all(projectId, limit) as Array<{
          score: number;
          grade: string;
          breakdown: string;
          git_commit: string | null;
          timestamp: string;
        }>;

      const history = rows.map((r) => ({
        score: r.score,
        grade: r.grade,
        gitCommit: r.git_commit,
        timestamp: r.timestamp,
      }));

      res.json({ ok: true, history, total: history.length });
    } catch (err) {
      logger.error("api:harness:history:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/trends — statistical trends (min, max, avg, stddev, direction)
   * Calculated over the last 30 harness_history records.
   */
  router.get("/trends", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();
      const project = store.getActiveProject();
      const projectId = project?.id ?? "default";

      const rows = db
        .prepare(
          "SELECT score FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 30",
        )
        .all(projectId) as Array<{ score: number }>;

      if (rows.length === 0) {
        res.json({ ok: true, min: 0, max: 0, avg: 0, stddev: 0, direction: "no_data", dataPoints: 0 });
        return;
      }

      const scores = rows.map((r) => r.score);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

      // Standard deviation
      const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length;
      const stddev = Math.round(Math.sqrt(variance) * 10) / 10;

      // Direction: compare first half avg vs second half avg
      let direction: "improving" | "declining" | "stable" | "no_data" = "stable";
      if (scores.length >= 4) {
        const mid = Math.floor(scores.length / 2);
        const recentAvg = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
        const olderAvg = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
        const delta = recentAvg - olderAvg;
        if (delta > 2) direction = "improving";
        else if (delta < -2) direction = "declining";
      }

      res.json({ ok: true, min, max, avg, stddev, direction, dataPoints: scores.length });
    } catch (err) {
      logger.error("api:harness:trends:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/advice — per-dimension remediation suggestions
   */
  router.get("/advice", (_req, res, next) => {
    try {
      const cached = runHarnessScanCached(process.cwd());
      if (!cached) {
        res.json({ ok: true, score: 0, grade: "D", advice: [], message: "Harness scan unavailable" });
        return;
      }

      const breakdown = cached.breakdown as Record<string, { score: number }>;
      const advice: Array<{ dimension: string; score: number; suggestion: string }> = [];

      for (const [dim, info] of Object.entries(breakdown)) {
        if (info.score >= 70) continue;
        const suggestions: Record<string, string> = {
          types: "Replace 'any' with explicit types",
          tests: "Create test files for untested modules",
          fitness: "Fix dependency direction or circular deps",
          docs: "Expand CLAUDE.md and README.md",
          naming: "Rename generic variables (data, result, temp)",
          errorHandling: "Use typed errors from utils/errors.ts",
          contextDensity: "Add JSDoc to exported functions",
        };
        advice.push({ dimension: dim, score: info.score, suggestion: suggestions[dim] ?? "Improve this dimension" });
      }

      const message = advice.length === 0
        ? "Harness score healthy — all dimensions >= 70"
        : `${advice.length} dimension(s) need improvement`;

      res.json({ ok: true, score: cached.score, grade: cached.grade, advice, message });
    } catch (err) {
      logger.error("api:harness:advice:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/patterns — all tracked issue patterns (steering loop)
   */
  router.get("/patterns", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const tracker = new IssuePatternTracker(store.getDb());
      const patterns = tracker.getAllPatterns();
      const stats = tracker.getStats();

      res.json({ ok: true, patterns, stats, threshold: 3 });
    } catch (err) {
      logger.error("api:harness:patterns:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/events — recent harness events (scans, warnings, regressions)
   */
  router.get("/events", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();
      const project = store.getActiveProject();
      const projectId = project?.id ?? "default";

      const rows = db
        .prepare(
          "SELECT score, grade, git_commit, timestamp FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 20",
        )
        .all(projectId) as Array<{
          score: number;
          grade: string;
          git_commit: string | null;
          timestamp: string;
        }>;

      const events = rows.map((row, idx) => {
        const prevRow = rows[idx + 1];
        const delta = prevRow ? Math.round((row.score - prevRow.score) * 10) / 10 : null;

        let type: "scan" | "warning" | "regression";
        let message: string;

        if (delta !== null && delta < -5) {
          type = "regression";
          message = `Score dropped ${Math.abs(delta)} points (${prevRow.score} → ${row.score})`;
        } else if (row.score < 70) {
          type = "warning";
          message = row.score < 55
            ? `High hallucination risk — score ${row.score} (grade ${row.grade})`
            : `Moderate quality gap — score ${row.score} (grade ${row.grade})`;
        } else {
          type = "scan";
          message = `Harness scan completed — score ${row.score} (grade ${row.grade})`;
        }

        return {
          type,
          score: row.score,
          grade: row.grade,
          delta,
          message,
          timestamp: row.timestamp,
          gitCommit: row.git_commit,
        };
      });

      res.json({ ok: true, events });
    } catch (err) {
      logger.error("api:harness:events:error", { error: String(err) });
      next(err);
    }
  });

  // ── Remediation Engine v4 endpoints ─────────────────────

  /**
   * GET /api/harness/remediate — deterministic remediation suggestions
   */
  router.get("/remediate", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();
      const scan = runHarnessScan(process.cwd(), db, undefined, { collectViolations: true });
      const suggestions = evaluateRemediations(scan.violations ?? [], db);

      res.json({
        ok: true,
        score: scan.score,
        grade: scan.grade,
        suggestions: suggestions.map((s) => ({
          ruleId: s.ruleId,
          file: s.violation.file,
          line: s.violation.line,
          dimension: s.violation.dimension,
          violationType: s.violation.violationType,
          suggestedFix: s.suggestedFix,
          confidence: s.confidence,
          category: s.category,
          priority: s.priority,
        })),
        totalViolations: scan.violations?.length ?? 0,
      });
    } catch (err) {
      logger.error("api:harness:remediate:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * POST /api/harness/remediate/suppress — suppress a (file, violationType) pair
   */
  router.post("/remediate/suppress", (req, res, next) => {
    try {
      const { file, violationType, dimension, reason } = req.body as {
        file?: string; violationType?: string; dimension?: string; reason?: string;
      };
      if (!file || !violationType) {
        res.status(400).json({ ok: false, error: "file and violationType are required" });
        return;
      }

      const store = storeRef.current;
      const suppressionStore = new SuppressionStore(store.getDb());
      suppressionStore.suppress(file, violationType, dimension ?? "unknown", reason);

      logger.info("api:harness:remediate:suppress:ok", { file, violationType });
      res.status(201).json({ ok: true, file, violationType, suppressed: true });
    } catch (err) {
      logger.error("api:harness:remediate:suppress:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/remediate/suppressions — list active suppressions
   */
  router.get("/remediate/suppressions", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const suppressionStore = new SuppressionStore(store.getDb());
      const suppressions = suppressionStore.listSuppressions();

      res.json({ ok: true, suppressions, total: suppressions.length });
    } catch (err) {
      logger.error("api:harness:remediate:suppressions:error", { error: String(err) });
      next(err);
    }
  });

  /**
   * GET /api/harness/contract-violations — recent architecture violations
   */
  router.get("/contract-violations", (_req, res, _next) => {
    try {
      const store = storeRef.current;
      const db = store.getDb();

      const rows = db.prepare(
        `SELECT id, rule_id, file, line, message, severity, node_id, created_at
         FROM contract_violations
         ORDER BY created_at DESC
         LIMIT 50`,
      ).all() as Array<Record<string, unknown>>;

      res.json({ violations: rows, total: rows.length });
    } catch (err) {
      // Table may not exist yet
      res.json({ violations: [], total: 0 });
      logger.debug("api:harness:contract-violations:empty", { error: String(err) });
    }
  });

  return router;
}
