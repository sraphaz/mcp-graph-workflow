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
 * Tier Promotion — enforces evidence requirements for epistemic tier transitions.
 *
 * Tiers (ascending): claim → cited → validated → proven
 *
 * Evidence required per target tier:
 *   cited    — citation_id that resolves (checked via resolveCitationId callback)
 *   validated — test_run_id (non-empty)
 *   proven   — provenance_receipt_id (non-empty, e.g. OTS hash)
 *
 * Emits a `tier_promoted` event on success. Pure function — no I/O.
 */

import { McpGraphError } from "../utils/errors.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type EpistemicTier = "claim" | "cited" | "validated" | "proven";

export interface PromotionEvidence {
  readonly citation_id?: string;
  readonly test_run_id?: string;
  readonly provenance_receipt_id?: string;
}

export interface PromotionInput {
  readonly nodeId: string;
  readonly currentTier: EpistemicTier;
  readonly targetTier: EpistemicTier;
  readonly evidence: PromotionEvidence;
  /** Optional resolver; defaults to always-true when omitted. */
  readonly resolveCitationId?: (id: string) => boolean;
}

export interface PromotionEvent {
  readonly type: "tier_promoted";
  readonly nodeId: string;
  readonly from: EpistemicTier;
  readonly to: EpistemicTier;
  readonly timestamp: string;
}

export interface PromotionResult {
  readonly tier: EpistemicTier;
  readonly events: readonly PromotionEvent[];
}

// ── Typed errors ───────────────────────────────────────────────────────────

export class MissingEvidenceError extends McpGraphError {
  constructor(artifact: string, targetTier: EpistemicTier) {
    super(`'${artifact}' is required to promote to tier '${targetTier}'`);
    this.name = "MissingEvidenceError";
  }
}

export class InvalidCitationError extends McpGraphError {
  constructor(citationId: string) {
    super(`citation_id '${citationId}' could not be resolved`);
    this.name = "InvalidCitationError";
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function promoteTier(input: PromotionInput): PromotionResult {
  const { nodeId, currentTier, targetTier, evidence, resolveCitationId } = input;

  validateEvidence(targetTier, evidence, resolveCitationId);

  const event: PromotionEvent = {
    type: "tier_promoted",
    nodeId,
    from: currentTier,
    to: targetTier,
    timestamp: new Date().toISOString(),
  };

  return { tier: targetTier, events: [event] };
}

// ── Private ────────────────────────────────────────────────────────────────

function validateEvidence(
  targetTier: EpistemicTier,
  evidence: PromotionEvidence,
  resolveCitationId?: (id: string) => boolean,
): void {
  if (targetTier === "cited") {
    if (!evidence.citation_id) {
      throw new MissingEvidenceError("citation_id", "cited");
    }
    const resolve = resolveCitationId ?? (() => true);
    if (!resolve(evidence.citation_id)) {
      throw new InvalidCitationError(evidence.citation_id);
    }
  }

  if (targetTier === "validated") {
    if (!evidence.test_run_id) {
      throw new MissingEvidenceError("test_run_id", "validated");
    }
  }

  if (targetTier === "proven") {
    if (!evidence.provenance_receipt_id) {
      throw new MissingEvidenceError("provenance_receipt_id", "proven");
    }
  }
}
