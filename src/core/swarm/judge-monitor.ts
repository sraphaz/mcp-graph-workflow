/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * JudgeMonitor — health monitoring for swarm sessions.
 * Inspired by hive-main Judge Pipeline (2-min ticks, stall detection, doom loop detection).
 *
 * Operates independently: checks session health on each tick or on-demand via checkHealth().
 * Does not mutate sessions — purely observational (read-only).
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export interface HealthCheckResult {
  sessionId: string;
  status: "healthy" | "inactive" | "stalled" | "not_found";
  checkedAt: number;
  lastUpdatedAt?: number;
  stallDurationMs?: number;
  message?: string;
}

export interface JudgeReport {
  checkedCount: number;
  timestamp: number;
  results: HealthCheckResult[];
}

export interface JudgeMonitorOptions {
  /** How often the judge ticks (ms). Default: 120_000 (2 min like hive). */
  tickIntervalMs?: number;
  /** How long without update before session is considered stalled (ms). Default: 600_000 (10 min). */
  stallThresholdMs?: number;
}

export class JudgeMonitor {
  private readonly db: Database.Database;
  private readonly tickIntervalMs: number;
  private readonly stallThresholdMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private results: HealthCheckResult[] = [];

  constructor(db: Database.Database, opts: JudgeMonitorOptions = {}) {
    this.db = db;
    this.tickIntervalMs = opts.tickIntervalMs ?? 120_000;
    this.stallThresholdMs = opts.stallThresholdMs ?? 600_000;
  }

  /** Start background tick loop. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickIntervalMs);
    logger.info("judge:monitor:start", { tickIntervalMs: this.tickIntervalMs });
  }

  /** Stop background tick loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("judge:monitor:stop");
    }
  }

  /** On-demand health check for a single session. */
  checkHealth(sessionId: string): HealthCheckResult {
    const row = this.db
      .prepare("SELECT id, status, updated_at FROM swarm_sessions WHERE id = ?")
      .get(sessionId) as { id: string; status: string; updated_at: string } | undefined;

    const checkedAt = Date.now();

    if (!row) {
      const resultValue: HealthCheckResult = { sessionId, status: "not_found", checkedAt };
      this.recordResult(resultValue);
      return resultValue;
    }

    if (row.status === "stopped" || row.status === "pending") {
      const resultValue: HealthCheckResult = { sessionId, status: "inactive", checkedAt };
      this.recordResult(resultValue);
      return resultValue;
    }

    const lastUpdatedAt = new Date(row.updated_at).getTime();
    const stallDurationMs = checkedAt - lastUpdatedAt;

    if (stallDurationMs > this.stallThresholdMs) {
      const resultValue: HealthCheckResult = {
        sessionId,
        status: "stalled",
        checkedAt,
        lastUpdatedAt,
        stallDurationMs,
        message: `Session has not updated in ${Math.round(stallDurationMs / 1000)}s`,
      };
      logger.warn("judge:stall_detected", { sessionId, stallDurationMs });
      this.recordResult(resultValue);
      return resultValue;
    }

    const resultValue: HealthCheckResult = { sessionId, status: "healthy", checkedAt, lastUpdatedAt };
    this.recordResult(resultValue);
    return resultValue;
  }

  /** Returns the accumulated report for all checks performed so far. */
  getReport(): JudgeReport {
    return {
      checkedCount: this.results.length,
      timestamp: Date.now(),
      results: [...this.results],
    };
  }

  private tick(): void {
    const activeSessions = this.db
      .prepare("SELECT id FROM swarm_sessions WHERE status = 'active'")
      .all() as Array<{ id: string }>;

    for (const { id } of activeSessions) {
      this.checkHealth(id);
    }

    logger.info("judge:tick", { checked: activeSessions.length });
  }

  private recordResult(result: HealthCheckResult): void {
    this.results.push(result);
    // Keep last 500 results to avoid unbounded memory growth
    if (this.results.length > 500) {
      this.results = this.results.slice(-500);
    }
  }
}
