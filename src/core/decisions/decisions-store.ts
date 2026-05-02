/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-9.T02 — decisions store (record / outcome / list / stats / audit).
 * Powers the `decide` MCP tool with deterministic CRUD + aggregation.
 */

import type Database from "better-sqlite3";
import { InvalidArgumentError } from "../utils/errors.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const AUDIT_STALE_DAYS = 7;

export interface DecisionInput {
  intent: string;
  options: string[];
  chosen: string;
  reasoning: string;
  nodeId?: string;
}

export interface DecisionOutcome {
  success: boolean;
  result?: string;
  summary: string;
}

export interface DecisionRow {
  id: string;
  intent: string;
  options: string[];
  chosen: string;
  reasoning: string;
  nodeId?: string;
  success?: boolean;
  resultSummary?: string;
  outcomeAt?: string;
  createdAt: string;
}

export interface DecisionStats {
  totalDecisions: number;
  byIntent: Record<string, { count: number; successRate: number; outcomes: number }>;
}

function rowToDecision(row: Record<string, unknown>): DecisionRow {
  return {
    id: row.id as string,
    intent: row.intent as string,
    options: JSON.parse(row.options_json as string) as string[],
    chosen: row.chosen as string,
    reasoning: row.reasoning as string,
    nodeId: (row.node_id as string | null) ?? undefined,
    success:
      row.success === null || row.success === undefined
        ? undefined
        : Boolean(row.success),
    resultSummary: (row.result_summary as string | null) ?? undefined,
    outcomeAt: (row.outcome_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

/** Validates AC: chosen must be one of options, options must be non-empty. */
export function recordDecision(db: Database.Database, input: DecisionInput): string {
  if (input.options.length === 0) {
    throw new InvalidArgumentError("decisions:record — options[] must be non-empty");
  }
  if (!input.options.includes(input.chosen)) {
    throw new InvalidArgumentError("decisions:record — chosen must be present in options[]");
  }
  const id = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO decisions (id, intent, options_json, chosen, reasoning, node_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.intent,
    JSON.stringify(input.options),
    input.chosen,
    input.reasoning,
    input.nodeId ?? null,
    now,
  );
  return id;
}

export function recordOutcome(
  db: Database.Database,
  decisionId: string,
  outcome: DecisionOutcome,
): boolean {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `UPDATE decisions
         SET success = ?, result_summary = ?, outcome_at = ?
       WHERE id = ?`,
    )
    .run(outcome.success ? 1 : 0, outcome.result ?? outcome.summary, now, decisionId);
  return info.changes > 0;
}

export function listDecisions(
  db: Database.Database,
  opts: { nodeId?: string; limit?: number } = {},
): DecisionRow[] {
  const limit = opts.limit ?? 100;
  const params: Array<string | number> = [];
  let where = "";
  if (opts.nodeId) {
    where = "WHERE node_id = ?";
    params.push(opts.nodeId);
  }
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT * FROM decisions ${where} ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToDecision);
}

export function statsDecisions(db: Database.Database): DecisionStats {
  const rows = db
    .prepare(`SELECT intent, success FROM decisions`)
    .all() as Array<{ intent: string; success: number | null }>;
  const byIntent: Record<string, { count: number; successRate: number; outcomes: number }> = {};
  for (const r of rows) {
    const slot = byIntent[r.intent] ?? { count: 0, successRate: 0, outcomes: 0 };
    slot.count++;
    if (r.success === 1 || r.success === 0) {
      slot.outcomes++;
      if (r.success === 1) slot.successRate += 1;
    }
    byIntent[r.intent] = slot;
  }
  for (const intent of Object.keys(byIntent)) {
    const s = byIntent[intent];
    s.successRate = s.outcomes > 0 ? s.successRate / s.outcomes : 0;
  }
  return { totalDecisions: rows.length, byIntent };
}

/** Returns decisions older than AUDIT_STALE_DAYS without recorded outcome. */
export function auditDecisions(
  db: Database.Database,
  opts: { nodeId?: string; staleDays?: number; nowMs?: number } = {},
): DecisionRow[] {
  const now = opts.nowMs ?? Date.now();
  const threshold = now - (opts.staleDays ?? AUDIT_STALE_DAYS) * DAY_MS;
  const cutoff = new Date(threshold).toISOString();
  const params: Array<string> = [cutoff];
  let where = `WHERE outcome_at IS NULL AND created_at < ?`;
  if (opts.nodeId) {
    where += ` AND node_id = ?`;
    params.push(opts.nodeId);
  }
  const rows = db
    .prepare(`SELECT * FROM decisions ${where} ORDER BY created_at ASC`)
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToDecision);
}
