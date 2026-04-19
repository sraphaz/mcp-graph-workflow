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
 * DecisionStore — Persistent log for agent confidence decisions with replay.
 *
 * Implements Decision Theory (von Neumann & Morgenstern, 1944) with
 * Counterfactual Analysis (Pearl, 2000): every decision is persisted with
 * its full evidence and weights, enabling "what-if" replay with alternative
 * configurations.
 *
 * Layer: L0_SQL (persistence) + L4_MetaRule (replay/learning).
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";
import type { ConfidenceEvidence, ConfidenceDecision } from "../autonomy/confidence-scorer.js";

// ── Interfaces ─────────────────────────────────────────

export interface DecisionWeights {
  rag: number;
  harness: number;
  historical: number;
}

export interface DecisionLogEntry {
  traceId: string;
  nodeId: string;
  decision: "continue" | "pause" | "stop";
  confidenceScore: number;
  evidence: ConfidenceEvidence;
  weightsUsed: DecisionWeights;
  policyName?: string;
  guardrailPassRate?: number;
}

export interface DecisionRecord {
  id: string;
  traceId: string;
  nodeId: string;
  decision: string;
  confidenceScore: number;
  evidence: ConfidenceEvidence;
  weightsUsed: DecisionWeights;
  policyName: string;
  guardrailPassRate: number | null;
  outcome: string | null;
  createdAt: string;
}

export interface PolicyAccuracy {
  total: number;
  correct: number;
  accuracy: number;
}

// ── Row type (SQLite) ──────────────────────────────────

interface DecisionRow {
  id: string;
  trace_id: string;
  node_id: string;
  decision: string;
  confidence_score: number;
  evidence: string;
  weights_used: string;
  policy_name: string;
  guardrail_pass_rate: number | null;
  outcome: string | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────

const CONTINUE_THRESHOLD = 70;
const PAUSE_THRESHOLD = 50;

// ── DecisionStore ──────────────────────────────────────

export class DecisionStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Record a confidence decision with full evidence. */
  record(entry: DecisionLogEntry): string {
    const id = generateId("decision");
    const createdAt = now();

    this.db.prepare(
      `INSERT INTO decision_log (id, trace_id, node_id, decision, confidence_score,
         evidence, weights_used, policy_name, guardrail_pass_rate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      entry.traceId,
      entry.nodeId,
      entry.decision,
      entry.confidenceScore,
      JSON.stringify(entry.evidence),
      JSON.stringify(entry.weightsUsed),
      entry.policyName ?? "default",
      entry.guardrailPassRate ?? null,
      createdAt,
    );

    logger.debug("decision:recorded", { id, nodeId: entry.nodeId, decision: entry.decision, score: entry.confidenceScore });
    return id;
  }

  /** Close the feedback loop by recording the outcome of a decision. */
  recordOutcome(decisionId: string, outcome: "success" | "failure"): void {
    this.db.prepare(
      "UPDATE decision_log SET outcome = ? WHERE id = ?",
    ).run(outcome, decisionId);

    logger.debug("decision:outcome", { decisionId, outcome });
  }

  /** Get all decisions for a node, ordered by created_at ASC. */
  getByNode(nodeId: string): DecisionRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM decision_log WHERE node_id = ? ORDER BY created_at ASC",
    ).all(nodeId) as DecisionRow[];

    return rows.map((r) => this.mapRow(r));
  }

  /** Get all decisions for a trace, ordered by created_at ASC. */
  getByTrace(traceId: string): DecisionRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM decision_log WHERE trace_id = ? ORDER BY created_at ASC",
    ).all(traceId) as DecisionRow[];

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Replay a historical decision with alternative weights.
   * Implements counterfactual analysis (Pearl, 2000):
   * given the SAME evidence, what would the agent decide with DIFFERENT weights?
   */
  replay(decisionId: string, alternativeWeights: DecisionWeights): ConfidenceDecision | null {
    const row = this.db.prepare(
      "SELECT * FROM decision_log WHERE id = ?",
    ).get(decisionId) as DecisionRow | undefined;

    if (!row) return null;

    const evidence = JSON.parse(row.evidence) as ConfidenceEvidence;

    // Recompute score with alternative weights
    const ragContribution = evidence.ragRelevance * 100 * alternativeWeights.rag;
    const harnessContribution = evidence.harnessScore * alternativeWeights.harness;
    const historicalContribution = evidence.historicalSuccessRate * 100 * alternativeWeights.historical;

    const rawScore = ragContribution + harnessContribution + historicalContribution;
    const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

    let action: "continue" | "pause" | "stop";
    if (score > CONTINUE_THRESHOLD) {
      action = "continue";
    } else if (score >= PAUSE_THRESHOLD) {
      action = "pause";
    } else {
      action = "stop";
    }

    return {
      score,
      action,
      evidence: {
        ...evidence,
        ragContribution: Math.round(ragContribution * 10) / 10,
        harnessContribution: Math.round(harnessContribution * 10) / 10,
        historicalContribution: Math.round(historicalContribution * 10) / 10,
      },
    };
  }

  /**
   * Compute accuracy of a named policy.
   * Accuracy = decisions where outcome matches expectation / total with outcomes.
   * For "continue" decisions, success = correct. For "stop", failure = correct.
   */
  getAccuracyByPolicy(policyName: string): PolicyAccuracy {
    const rows = this.db.prepare(
      "SELECT decision, outcome FROM decision_log WHERE policy_name = ? AND outcome IS NOT NULL",
    ).all(policyName) as Array<{ decision: string; outcome: string }>;

    if (rows.length === 0) return { total: 0, correct: 0, accuracy: 0 };

    let correct = 0;
    for (const row of rows) {
      if (
        (row.decision === "continue" && row.outcome === "success") ||
        (row.decision === "stop" && row.outcome === "failure") ||
        (row.decision === "pause" && row.outcome === "success")
      ) {
        correct++;
      }
    }

    return {
      total: rows.length,
      correct,
      accuracy: correct / rows.length,
    };
  }

  // ── Internal ───────────────────────────────────────

  private mapRow(row: DecisionRow): DecisionRecord {
    return {
      id: row.id,
      traceId: row.trace_id,
      nodeId: row.node_id,
      decision: row.decision,
      confidenceScore: row.confidence_score,
      evidence: JSON.parse(row.evidence) as ConfidenceEvidence,
      weightsUsed: JSON.parse(row.weights_used) as DecisionWeights,
      policyName: row.policy_name,
      guardrailPassRate: row.guardrail_pass_rate,
      outcome: row.outcome,
      createdAt: row.created_at,
    };
  }
}
