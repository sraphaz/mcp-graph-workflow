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
 * Corrective RAG — validates retrieved results against the execution graph state.
 *
 * Checks:
 * 1. Node existence: Does the linked node still exist in the graph?
 * 2. Staleness detection: Has the node changed after the knowledge doc was created?
 * 3. Status-aware confidence: Adjust confidence based on current node status.
 *
 * Results with low confidence are penalized or filtered out.
 */

import type Database from "better-sqlite3";
import type { SqliteStore } from "../store/sqlite-store.js";
import type { RankedResult } from "./multi-strategy-retrieval.js";
import { logger } from "../utils/logger.js";

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  docId: string;
  isValid: boolean;
  confidenceScore: number;
  staleness: "fresh" | "aging" | "stale";
  issues: string[];
}

interface CorrectionOptions {
  minConfidence?: number;
}

/**
 * Validate retrieved results against the execution graph's current state.
 *
 * For each result:
 * 1. Look up the linked node via metadata.nodeId
 * 2. Check node existence
 * 3. Compare timestamps (node.updatedAt vs doc.createdAt)
 * 4. Assign confidence score based on freshness and node status
 */
export function validateRetrievedResults(
  results: RankedResult[],
  db: Database.Database,
  store: SqliteStore,
): ValidationResult[] {
  const validations: ValidationResult[] = [];

  for (const resultValue of results) {
    const validation = validateSingleResult(resultValue, db, store);
    validations.push(validation);
  }

  logger.debug("corrective-rag: validation complete", {
    total: validations.length,
    fresh: validations.filter((v) => v.staleness === "fresh").length,
    aging: validations.filter((v) => v.staleness === "aging").length,
    stale: validations.filter((v) => v.staleness === "stale").length,
  });

  return validations;
}

/**
 * Apply corrective scoring: multiply result scores by confidence,
 * filter out results below minimum confidence threshold.
 */
export function correctResults(
  results: RankedResult[],
  validations: ValidationResult[],
  options?: CorrectionOptions,
): RankedResult[] {
  const minConfidence = options?.minConfidence ?? 0.2;
  const validationMap = new Map(validations.map((v) => [v.docId, v]));

  const corrected: RankedResult[] = [];

  for (const resultValue of results) {
    const validation = validationMap.get(resultValue.id);
    if (!validation) {
      // No validation data — keep as-is
      corrected.push(resultValue);
      continue;
    }

    // Filter out results below confidence threshold
    if (validation.confidenceScore < minConfidence) {
      logger.debug("corrective-rag: filtering low-confidence result", {
        docId: resultValue.id,
        confidence: validation.confidenceScore,
        staleness: validation.staleness,
      });
      continue;
    }

    // Apply confidence multiplier to score
    const adjustedScore = resultValue.score * validation.confidenceScore;
    corrected.push({
      ...resultValue,
      score: Math.round(adjustedScore * 10000) / 10000,
    });
  }

  // Re-sort by corrected score
  corrected.sort((a, b) => b.score - a.score);

  return corrected;
}

// ── Internal helpers ────────────────────────────────────

/**
 * Validate a single result against the execution graph.
 */
function validateSingleResult(
  result: RankedResult,
  db: Database.Database,
  store: SqliteStore,
): ValidationResult {
  const issues: string[] = [];

  // Look up the knowledge doc's linked nodeId from metadata
  const nodeId = getLinkedNodeId(db, result.id);

  // No nodeId → no graph validation possible → neutral confidence
  if (!nodeId) {
    return {
      docId: result.id,
      isValid: true,
      confidenceScore: 0.7,
      staleness: "fresh",
      issues: [],
    };
  }

  // Check if node exists in the execution graph
  const node = store.getNodeById(nodeId);
  if (!node) {
    issues.push("node_deleted");
    return {
      docId: result.id,
      isValid: false,
      confidenceScore: 0.3,
      staleness: "stale",
      issues,
    };
  }

  // Compare timestamps: doc creation vs node last update
  const docCreatedAt = getDocTimestamp(db, result.id);
  const nodeUpdatedAt = node.updatedAt;

  let staleness: "fresh" | "aging" | "stale" = "fresh";
  let confidenceScore = 0.9;

  if (docCreatedAt && nodeUpdatedAt) {
    const docTime = new Date(docCreatedAt).getTime();
    const nodeTime = new Date(nodeUpdatedAt).getTime();

    if (nodeTime > docTime) {
      // Node was updated after the doc was created
      const ageDays = (nodeTime - docTime) / (1000 * 60 * 60 * 24);

      if (ageDays > 7) {
        staleness = "stale";
        confidenceScore = 0.4;
        issues.push("node_updated_after_doc");
      } else if (ageDays > 1) {
        staleness = "aging";
        confidenceScore = 0.6;
        issues.push("node_recently_updated");
      }
    }
  }

  // Status-aware confidence adjustment
  confidenceScore = adjustForNodeStatus(confidenceScore, node.status);

  return {
    docId: result.id,
    isValid: confidenceScore >= 0.3,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    staleness,
    issues,
  };
}

/**
 * Adjust confidence based on the current node status.
 * - done: knowledge is stable (decisions made) → slight boost
 * - in_progress: knowledge is actively evolving → neutral
 * - blocked: knowledge may be outdated → slight penalty
 * - backlog/ready: knowledge is preliminary → slight penalty
 */
function adjustForNodeStatus(confidence: number, status: string): number {
  switch (status) {
    case "done":
      return Math.min(confidence * 1.1, 1.0);
    case "in_progress":
      return confidence;
    case "blocked":
      return confidence * 0.9;
    case "backlog":
    case "ready":
      return confidence * 0.85;
    default:
      return confidence;
  }
}

/**
 * Get the linked nodeId from a knowledge document's metadata.
 */
function getLinkedNodeId(db: Database.Database, docId: string): string | null {
  try {
    const row = db
      .prepare(
        `SELECT json_extract(metadata, '$.nodeId') AS nodeId
         FROM knowledge_documents WHERE id = ?`,
      )
      .get(docId) as { nodeId: string | null } | undefined;
    return row?.nodeId ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the creation timestamp of a knowledge document.
 */
function getDocTimestamp(db: Database.Database, docId: string): string | null {
  try {
    const row = db
      .prepare("SELECT created_at FROM knowledge_documents WHERE id = ?")
      .get(docId) as { created_at: string } | undefined;
    return row?.created_at ?? null;
  } catch {
    return null;
  }
}

// ── Retry Policy ──────────────────────────────────────────

// ── Batch Confidence Formula ───────────────────────────────

/** Canonical confidence signal for a retrieval batch. */
export interface BatchConfidenceSignal {
  /** Arithmetic mean of confidenceScore across all validations. */
  mean: number;
  /** Minimum confidenceScore in the batch (worst-case). */
  min: number;
  /**
   * Composite score: weighted mean using confidenceScore² as weight,
   * rewarding batches with uniformly high confidence over mixed ones.
   * Range: [0, 1].
   */
  composite: number;
  /** Number of validations included. */
  count: number;
}

/**
 * Compute a structured confidence signal for a batch of validation results.
 *
 * Formula for composite: Σ(c_i² ) / Σ(c_i) when Σ(c_i) > 0, else 0.
 * This is a self-weighted mean that favours uniformly high-confidence batches.
 * Empty batches return all-zero signal.
 */
export function computeBatchConfidence(validations: ValidationResult[]): BatchConfidenceSignal {
  if (validations.length === 0) {
    return { mean: 0, min: 0, composite: 0, count: 0 };
  }

  const count = validations.length;
  let sum = 0;
  let sumSq = 0;
  let min = 1;

  for (const vVar of validations) {
    const cVar = vVar.confidenceScore;
    sum += cVar;
    sumSq += cVar * cVar;
    if (cVar < min) min = cVar;
  }

  const mean = sum / count;
  const composite = sum > 0 ? sumSq / sum : 0;

  return {
    mean: Math.round(mean * 10000) / 10000,
    min: Math.round(min * 10000) / 10000,
    composite: Math.min(Math.round(composite * 10000) / 10000, 1),
    count,
  };
}

/** Default confidence threshold below which a second retrieval pass is triggered. */
export const RETRY_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Determine whether a second retrieval pass is needed based on mean confidence.
 *
 * Returns true only when the mean confidence across all validations is strictly
 * below the given threshold. Empty validation arrays never trigger a retry.
 */
export function needsRetry(
  validations: ValidationResult[],
  threshold: number = RETRY_CONFIDENCE_THRESHOLD,
): boolean {
  if (validations.length === 0) return false;
  const mean = validations.reduce((sum, v) => sum + v.confidenceScore, 0) / validations.length;
  return mean < threshold;
}

// ── Deterministic Retry Policy ──────────────────────────────

/** Encapsulates the configurable retry rule for a retrieval pass. */
export interface RetryPolicy {
  /** Composite confidence must be strictly below this to trigger a retry. */
  confidenceThreshold: number;
  /** Maximum number of retry passes per query (1 = one retry, 0 = never retry). */
  maxRetries: number;
}

/** Default retry policy: threshold 0.5, at most 1 retry per query. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  confidenceThreshold: RETRY_CONFIDENCE_THRESHOLD,
  maxRetries: 1,
};

/** Create a RetryPolicy with optional overrides. */
export function createRetryPolicy(
  options?: Partial<RetryPolicy>,
): RetryPolicy {
  return {
    confidenceThreshold: options?.confidenceThreshold ?? DEFAULT_RETRY_POLICY.confidenceThreshold,
    maxRetries: options?.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries,
  };
}

/**
 * Deterministic retry decision: true iff the batch confidence is below threshold
 * AND the current retryCount has not yet reached maxRetries.
 *
 * Same inputs always produce the same output (no randomness, no side effects).
 */
export function shouldRetry(
  signal: Pick<BatchConfidenceSignal, "composite">,
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): boolean {
  if (retryCount >= policy.maxRetries) return false;
  return signal.composite < policy.confidenceThreshold;
}

// ── Cross-Reference Verification ────────────────────

export interface CrossRefCheck {
  /** The claim type detected (e.g., "dependency", "status", "parent"). */
  claimType: string;
  /** Whether the claim is verified against current graph state. */
  verified: boolean;
  /** Description of the check result. */
  detail: string;
}

/**
 * Verify claims in a knowledge document against the current execution graph.
 *
 * Detects and validates references to:
 * - Dependency relationships ("X depends on Y")
 * - Status claims ("X is done/in_progress")
 * - Parent-child relationships ("subtask of X")
 *
 * Returns a list of cross-reference checks.
 */
export function verifyCrossReferences(
  content: string,
  db: Database.Database,
  store: SqliteStore,
): CrossRefCheck[] {
  const checks: CrossRefCheck[] = [];

  // Check dependency claims: "depends on", "depende de", "blocks", "bloqueia"
  const depPatterns = [
    /(?:depends?\s+on|depende\s+de)\s+"?([^",.]+)"?/gi,
    /(?:blocks?|bloqueia)\s+"?([^",.]+)"?/gi,
  ];

  for (const pattern of depPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const targetName = match[1].trim();
      const targetNode = findNodeByTitle(store, targetName);

      if (targetNode) {
        checks.push({
          claimType: "dependency",
          verified: true,
          detail: `Node "${targetName}" exists (status: ${targetNode.status})`,
        });
      } else {
        checks.push({
          claimType: "dependency",
          verified: false,
          detail: `Node "${targetName}" not found in graph`,
        });
      }
    }
  }

  // Check status claims: "X is done", "X está pronto"
  const statusPatterns = [
    /["']([^"']+)["']\s+(?:is|está|was)\s+(done|in_progress|blocked|ready|backlog)/gi,
  ];

  for (const pattern of statusPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const nodeName = match[1].trim();
      const claimedStatus = match[2].toLowerCase();
      const node = findNodeByTitle(store, nodeName);

      if (node) {
        const isCorrect = node.status === claimedStatus;
        checks.push({
          claimType: "status",
          verified: isCorrect,
          detail: isCorrect
            ? `"${nodeName}" status is correctly "${claimedStatus}"`
            : `"${nodeName}" status is "${node.status}", not "${claimedStatus}" as claimed`,
        });
      }
    }
  }

  return checks;
}

/**
 * Find a node by its title (case-insensitive substring match).
 */
function findNodeByTitle(store: SqliteStore, title: string): { status: string; id: string } | null {
  try {
    const allNodes = store.getAllNodes();
    const lowerTitle = title.toLowerCase();
    const match = allNodes.find((n) => n.title.toLowerCase().includes(lowerTitle));
    return match ? { status: match.status, id: match.id } : null;
  } catch {
    return null;
  }
}
