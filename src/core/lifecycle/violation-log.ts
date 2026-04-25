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
 * Violation Log — persists lifecycle gate bypass attempts.
 *
 * Every gate bypass (advisory or strict) is recorded even when the mode
 * allows the override to proceed. In strict mode, overrides without a
 * decision node are rejected outright.
 *
 * Queries return violations ordered by severity (high → medium → low) to
 * surface the most critical bypasses first during sprint reviews.
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { McpGraphError } from "../utils/errors.js";

export type ViolationSeverity = "low" | "medium" | "high";

export interface ViolationLogEntry {
  gateId: string;
  nodeId: string;
  sprint: string;
  reason: string;
  decisionNodeId?: string;
  severity: ViolationSeverity;
  /** "strict" = gate was blocking; "advisory" = gate was warning only */
  mode: "strict" | "advisory";
}

export interface ViolationRow {
  id: string;
  gateId: string;
  nodeId: string;
  sprint: string;
  reason: string;
  decisionNodeId: string | null;
  severity: ViolationSeverity;
  mode: "strict" | "advisory";
  createdAt: string;
}

const SEVERITY_ORDER: Record<ViolationSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Record a lifecycle gate violation or override.
 * Throws McpGraphError when mode is "strict" and decisionNodeId is absent.
 */
export function logViolation(db: Database.Database, entry: ViolationLogEntry): void {
  if (entry.mode === "strict" && !entry.decisionNodeId) {
    throw new McpGraphError(
      `Decision node required: strict-mode overrides must reference a decision node. ` +
      `Provide decisionNodeId to document the override rationale.`,
    );
  }

  db.prepare(`
    INSERT INTO lifecycle_violations
      (id, gate_id, node_id, sprint, reason, decision_node_id, severity, mode, created_at)
    VALUES
      (@id, @gateId, @nodeId, @sprint, @reason, @decisionNodeId, @severity, @mode, @createdAt)
  `).run({
    id: generateId(),
    gateId: entry.gateId,
    nodeId: entry.nodeId,
    sprint: entry.sprint,
    reason: entry.reason,
    decisionNodeId: entry.decisionNodeId ?? null,
    severity: entry.severity,
    mode: entry.mode,
    createdAt: now(),
  });
}

/**
 * Query all violations for a given sprint, ordered by severity (high → medium → low).
 */
export function queryViolationsBySprint(db: Database.Database, sprint: string): ViolationRow[] {
  const rows = db.prepare(`
    SELECT id, gate_id, node_id, sprint, reason, decision_node_id, severity, mode, created_at
    FROM lifecycle_violations
    WHERE sprint = ?
  `).all(sprint) as Array<{
    id: string;
    gate_id: string;
    node_id: string;
    sprint: string;
    reason: string;
    decision_node_id: string | null;
    severity: ViolationSeverity;
    mode: "strict" | "advisory";
    created_at: string;
  }>;

  return rows
    .map((r) => ({
      id: r.id,
      gateId: r.gate_id,
      nodeId: r.node_id,
      sprint: r.sprint,
      reason: r.reason,
      decisionNodeId: r.decision_node_id,
      severity: r.severity,
      mode: r.mode,
      createdAt: r.created_at,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
