/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-policy-engine-context-routing — Task 1.3: Modo observe
 *
 * PolicyObserver — records decideRoute observations without changing gateway behaviour.
 * SQLite persistence via policy_observations (migration v92).
 */

import type Database from "better-sqlite3";
import type { RouteDecision } from "./policy-engine.js";

export interface PolicyObservationSignals {
  promptTokensEstimate: number;
  budgetRemainingPct: number;
  latencyP95ByProvider: Record<string, number>;
  backendHealth: Record<string, string>;
}

export interface PolicyObservation {
  id: string;
  timestamp: string;
  signalsSnapshot: PolicyObservationSignals;
  decision: RouteDecision;
  actualUsed: string[];
  divergence: boolean;
}

/** Dependency-injection interface — swap for in-memory impl in tests. */
export interface PolicyObserver {
  record(obs: PolicyObservation): void;
}

// ---------------------------------------------------------------------------
// SQLite implementation
// ---------------------------------------------------------------------------

export class PolicyObserverStore implements PolicyObserver {
  private readonly db: Database.Database;
  private readonly projectId: string;

  constructor(db: Database.Database, projectId: string) {
    this.db = db;
    this.projectId = projectId;
  }

  record(obs: PolicyObservation): void {
    this.db
      .prepare(
        `INSERT INTO policy_observations
           (id, project_id, timestamp, signals_snapshot, decision, actual_used, divergence)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        obs.id,
        this.projectId,
        obs.timestamp,
        JSON.stringify(obs.signalsSnapshot),
        JSON.stringify(obs.decision),
        JSON.stringify(obs.actualUsed),
        obs.divergence ? 1 : 0,
      );
  }

  recent(limit: number): PolicyObservation[] {
    const rows = this.db
      .prepare(
        `SELECT id, timestamp, signals_snapshot, decision, actual_used, divergence
           FROM policy_observations
          WHERE project_id = ?
          ORDER BY timestamp DESC
          LIMIT ?`,
      )
      .all(this.projectId, limit) as Array<{
      id: string;
      timestamp: string;
      signals_snapshot: string;
      decision: string;
      actual_used: string;
      divergence: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      signalsSnapshot: JSON.parse(row.signals_snapshot) as PolicyObservationSignals,
      decision: JSON.parse(row.decision) as RouteDecision,
      actualUsed: JSON.parse(row.actual_used) as string[],
      divergence: row.divergence === 1,
    }));
  }
}
