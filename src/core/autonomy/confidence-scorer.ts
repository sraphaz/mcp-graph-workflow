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
 * Confidence Scorer — Decision Theory for Autonomous Agent Actions
 *
 * Computes a confidence score (0-100) for each agent decision,
 * determining whether to continue, pause, or stop autonomous execution.
 *
 * Score = RAG_relevance(40%) + harness_coverage(30%) + historical_success(30%)
 *
 * Based on: Decision Theory (von Neumann & Morgenstern) — expected utility.
 *
 * Thresholds:
 * - > 70: CONTINUE — execute silently
 * - 50-70: PAUSE — execute with detailed logging
 * - < 50: STOP — escalate to human
 */

import { createLogger } from "../utils/logger.js";
import { z } from "zod/v4";
import { McpGraphError } from "../utils/errors.js";

const log = createLogger({ layer: "core", source: "confidence-scorer.ts" });

// ── Zod Schemas ────────────────────────────────────────

export const ConfidenceInputSchema = z.object({
  ragRelevance: z.number().min(0).max(1),
  harnessScore: z.number().min(0).max(100),
  historicalSuccessRate: z.number().min(0).max(1),
});

// ── Types ───────────────────────────────────────────────

export interface ConfidenceInput {
  /** Average RAG relevance score (0-1) of top-5 results */
  ragRelevance: number;
  /** Current harness score (0-100) */
  harnessScore: number;
  /** Success rate of last 10 tasks of same type (0-1) */
  historicalSuccessRate: number;
}

export interface ConfidenceEvidence {
  ragRelevance: number;
  harnessScore: number;
  historicalSuccessRate: number;
  ragContribution: number;
  harnessContribution: number;
  historicalContribution: number;
}

export interface ConfidenceDecision {
  /** Composite confidence score (0-100) */
  score: number;
  /** Recommended action based on thresholds */
  action: "continue" | "pause" | "stop";
  /** Breakdown of evidence used to compute score */
  evidence: ConfidenceEvidence;
}

// ── Constants ───────────────────────────────────────────

const RAG_WEIGHT = 0.40;
const HARNESS_WEIGHT = 0.30;
const HISTORICAL_WEIGHT = 0.30;

const CONTINUE_THRESHOLD = 70;
const PAUSE_THRESHOLD = 50;

// ── Scorer ──────────────────────────────────────────────

/**
 * Compute confidence score and recommended action.
 *
 * Formula: score = ragRelevance*100*0.40 + harnessScore*0.30 + historicalSuccess*100*0.30
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceDecision {
  if (!input) throw new McpGraphError("ConfidenceInput is required");
  const parsed = ConfidenceInputSchema.safeParse(input);
  if (!parsed.success) throw new McpGraphError(`Invalid confidence input: ${parsed.error?.message ?? "validation failed"}`);
  const ragContribution = input.ragRelevance * 100 * RAG_WEIGHT;
  const harnessContribution = input.harnessScore * HARNESS_WEIGHT;
  const historicalContribution = input.historicalSuccessRate * 100 * HISTORICAL_WEIGHT;

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

  const evidence: ConfidenceEvidence = {
    ragRelevance: input.ragRelevance,
    harnessScore: input.harnessScore,
    historicalSuccessRate: input.historicalSuccessRate,
    ragContribution: Math.round(ragContribution * 10) / 10,
    harnessContribution: Math.round(harnessContribution * 10) / 10,
    historicalContribution: Math.round(historicalContribution * 10) / 10,
  };

  log.debug("confidence-scorer:compute", {
    score, action,
    ragContribution: evidence.ragContribution,
    harnessContribution: evidence.harnessContribution,
    historicalContribution: evidence.historicalContribution,
  });

  return { score, action, evidence };
}
