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

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export interface RecoveryMetricEntry { nodeId: string; action: "rollback" | "escalation" | "success"; success: boolean; mttrMs: number; attempt: number; timestamp?: string; }
export interface RecoveryMetricsSummary { totalRollbacks: number; totalEscalations: number; totalSuccesses: number; avgMttrMs: number; successRate: number; }

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS recovery_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, node_id TEXT NOT NULL, action TEXT NOT NULL, success INTEGER NOT NULL DEFAULT 0, mttr_ms INTEGER NOT NULL DEFAULT 0, attempt INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`;

export class RecoveryMetricsStore {
  private db: Database.Database;
  constructor(db: Database.Database) { this.db = db; this.db.exec(CREATE_TABLE); }

  record(entry: RecoveryMetricEntry): void {
    this.db.prepare("INSERT INTO recovery_metrics (node_id, action, success, mttr_ms, attempt, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").run(entry.nodeId, entry.action, entry.success ? 1 : 0, entry.mttrMs, entry.attempt);
    logger.debug("recovery-metrics:recorded", { nodeId: entry.nodeId, action: entry.action, mttrMs: entry.mttrMs });
  }

  getByNode(nodeId: string): RecoveryMetricEntry[] {
    const rows = this.db.prepare("SELECT node_id, action, success, mttr_ms, attempt, created_at FROM recovery_metrics WHERE node_id = ? ORDER BY created_at ASC").all(nodeId) as Array<{ node_id: string; action: string; success: number; mttr_ms: number; attempt: number; created_at: string }>;
    return rows.map((r) => ({ nodeId: r.node_id, action: r.action as RecoveryMetricEntry["action"], success: r.success === 1, mttrMs: r.mttr_ms, attempt: r.attempt, timestamp: r.created_at }));
  }

  getSummary(): RecoveryMetricsSummary {
    const rows = this.db.prepare("SELECT action, success, mttr_ms FROM recovery_metrics").all() as Array<{ action: string; success: number; mttr_ms: number }>;
    if (rows.length === 0) return { totalRollbacks: 0, totalEscalations: 0, totalSuccesses: 0, avgMttrMs: 0, successRate: 1 };
    const rollbacks = rows.filter((r) => r.action === "rollback").length;
    const escalations = rows.filter((r) => r.action === "escalation").length;
    const successes = rows.filter((r) => r.success === 1).length;
    const totalMttr = rows.reduce((sum, r) => sum + r.mttr_ms, 0);
    return { totalRollbacks: rollbacks, totalEscalations: escalations, totalSuccesses: successes, avgMttrMs: Math.round(totalMttr / rows.length), successRate: Math.round((successes / rows.length) * 100) / 100 };
  }

  getRecent(limit: number = 10): RecoveryMetricEntry[] {
    const rows = this.db.prepare("SELECT node_id, action, success, mttr_ms, attempt, created_at FROM recovery_metrics ORDER BY id DESC LIMIT ?").all(limit) as Array<{ node_id: string; action: string; success: number; mttr_ms: number; attempt: number; created_at: string }>;
    return rows.map((r) => ({ nodeId: r.node_id, action: r.action as RecoveryMetricEntry["action"], success: r.success === 1, mttrMs: r.mttr_ms, attempt: r.attempt, timestamp: r.created_at }));
  }
}
