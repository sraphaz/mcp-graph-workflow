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
 * Claim Protocol — formal specification for task lock lifecycle.
 *
 * Defines the schema and state machine for task claim records so that
 * external agents can interoperate without conflicts.
 *
 * States: active → released | expired
 *         expired → taken_over (new agent claims with predecessor log)
 *
 * Shadow branch rule: only fast-forward merges accepted. Non-FF → rebase required.
 */

import { z } from "zod/v4";

// ── Claim state machine ────────────────────────────────────────────────────

export const ClaimStateSchema = z.enum(["active", "released", "expired", "taken_over"]);
export type ClaimState = z.infer<typeof ClaimStateSchema>;

export const PredecessorClaimSchema = z.object({
  agentId: z.string(),
  leaseToken: z.string(),
  expiredAt: z.string(),
});
export type PredecessorClaim = z.infer<typeof PredecessorClaimSchema>;

export const ClaimRecordSchema = z.object({
  taskId: z.string(),
  agentId: z.string(),
  leaseToken: z.string(),
  acquiredAt: z.string(),
  expiresAt: z.string(),
  state: ClaimStateSchema,
  heartbeatAt: z.string().nullable(),
  predecessorClaim: PredecessorClaimSchema.nullable(),
});
export type ClaimRecord = z.infer<typeof ClaimRecordSchema>;

// ── Takeover schema (expired-lock claim) ──────────────────────────────────

export const ClaimTakeoverSchema = ClaimRecordSchema.extend({
  state: z.literal("active"),
  predecessorClaim: PredecessorClaimSchema,
});
export type ClaimTakeover = z.infer<typeof ClaimTakeoverSchema>;

// ── Shadow branch merge result ─────────────────────────────────────────────

export const ShadowBranchMergeResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
});
export type ShadowBranchMergeResult = z.infer<typeof ShadowBranchMergeResultSchema>;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Creates a new claim record that takes over an expired lock.
 * The predecessor claim is recorded for audit trail.
 */
export function createClaimTakeover(
  expired: ClaimRecord,
  newAgentId: string,
  newLeaseToken: string,
): ClaimRecord {
  const now = new Date().toISOString();
  return {
    taskId: expired.taskId,
    agentId: newAgentId,
    leaseToken: newLeaseToken,
    acquiredAt: now,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    state: "active",
    heartbeatAt: null,
    predecessorClaim: {
      agentId: expired.agentId,
      leaseToken: expired.leaseToken,
      expiredAt: expired.expiresAt,
    },
  };
}

export interface ShadowBranchMergeInput {
  shadowBranch: string;
  targetBranch: string;
  isFastForward: boolean;
}

/**
 * Validates that a shadow branch merge is a fast-forward.
 * Non-FF merges are rejected with an actionable rebase instruction.
 */
export function validateShadowBranchMerge(input: ShadowBranchMergeInput): ShadowBranchMergeResult {
  if (input.isFastForward) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      `Shadow branch "${input.shadowBranch}" cannot be merged into "${input.targetBranch}" ` +
      `without a fast-forward. Run: git rebase ${input.targetBranch} ${input.shadowBranch} ` +
      `and retry the merge.`,
  };
}
