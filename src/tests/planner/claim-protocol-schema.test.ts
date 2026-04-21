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

import { describe, it, expect } from "vitest";
import {
  ClaimRecordSchema,
  ClaimTakeoverSchema,
  ShadowBranchMergeResultSchema,
  createClaimTakeover,
  validateShadowBranchMerge,
} from "../../core/agents/claim-protocol.js";

// ── AC 1: spec publicada → agente externo coexiste sem conflito ───────────

describe("ClaimRecordSchema (AC 1 — external interop)", () => {
  it("should parse a valid active claim record", () => {
    const record = {
      taskId: "node_abc123",
      agentId: "agent-1",
      leaseToken: "token-xyz",
      acquiredAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:10:00.000Z",
      state: "active" as const,
      heartbeatAt: "2026-01-01T00:05:00.000Z",
      predecessorClaim: null,
    };

    const result = ClaimRecordSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("should parse a valid expired claim record", () => {
    const record = {
      taskId: "node_abc123",
      agentId: "agent-1",
      leaseToken: "token-xyz",
      acquiredAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:10:00.000Z",
      state: "expired" as const,
      heartbeatAt: null,
      predecessorClaim: null,
    };

    const result = ClaimRecordSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("should reject claim with invalid state", () => {
    const record = {
      taskId: "node_abc",
      agentId: "agent-1",
      leaseToken: "t1",
      acquiredAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:10:00.000Z",
      state: "unknown_state",
      heartbeatAt: null,
      predecessorClaim: null,
    };

    const result = ClaimRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
  });

  it("should allow all defined claim states", () => {
    const states = ["active", "released", "expired", "taken_over"] as const;

    for (const state of states) {
      const result = ClaimRecordSchema.safeParse({
        taskId: "node_abc",
        agentId: "agent-1",
        leaseToken: "t1",
        acquiredAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T00:10:00.000Z",
        state,
        heartbeatAt: null,
        predecessorClaim: null,
      });

      expect(result.success, `state '${state}' should be valid`).toBe(true);
    }
  });
});

// ── AC 2: lock expirado sem heartbeat → novo claim com log predecessor ────

describe("createClaimTakeover (AC 2 — expired lock takeover)", () => {
  const expiredClaim = {
    taskId: "node_abc123",
    agentId: "agent-1",
    leaseToken: "old-token",
    acquiredAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:05:00.000Z",
    state: "expired" as const,
    heartbeatAt: null,
    predecessorClaim: null,
  };

  it("should produce a new claim with predecessorClaim set to the expired claim", () => {
    const takeover = createClaimTakeover(expiredClaim, "agent-2", "new-token");

    expect(takeover.agentId).toBe("agent-2");
    expect(takeover.leaseToken).toBe("new-token");
    expect(takeover.state).toBe("active");
    expect(takeover.predecessorClaim).not.toBeNull();
    expect(takeover.predecessorClaim?.agentId).toBe("agent-1");
    expect(takeover.predecessorClaim?.leaseToken).toBe("old-token");
    expect(takeover.predecessorClaim?.expiredAt).toBe("2026-01-01T00:05:00.000Z");
  });

  it("should validate the takeover result with ClaimTakeoverSchema", () => {
    const takeover = createClaimTakeover(expiredClaim, "agent-2", "new-token");
    const result = ClaimTakeoverSchema.safeParse(takeover);

    expect(result.success).toBe(true);
  });

  it("should preserve the taskId from the expired claim", () => {
    const takeover = createClaimTakeover(expiredClaim, "agent-2", "new-token");

    expect(takeover.taskId).toBe(expiredClaim.taskId);
  });

  it("should set heartbeatAt to null initially on new claim", () => {
    const takeover = createClaimTakeover(expiredClaim, "agent-2", "new-token");

    expect(takeover.heartbeatAt).toBeNull();
  });
});

// ── AC 3: shadow branch sem FF → rejeitado com instrução de rebase ────────

describe("validateShadowBranchMerge (AC 3 — FF enforcement)", () => {
  it("should allow fast-forward merge", () => {
    const result = validateShadowBranchMerge({
      shadowBranch: "ai-shadow/node_abc-1776639479957",
      targetBranch: "master",
      isFastForward: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should reject non-FF merge with an actionable rebase instruction", () => {
    const result = validateShadowBranchMerge({
      shadowBranch: "ai-shadow/node_abc-1776639479957",
      targetBranch: "master",
      isFastForward: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("rebase");
  });

  it("should include the shadow branch name in the rejection reason", () => {
    const result = validateShadowBranchMerge({
      shadowBranch: "ai-shadow/node_abc-1776639479957",
      targetBranch: "master",
      isFastForward: false,
    });

    expect(result.reason).toContain("ai-shadow/node_abc-1776639479957");
  });

  it("should include the target branch in the rebase instruction", () => {
    const result = validateShadowBranchMerge({
      shadowBranch: "ai-shadow/node_abc-1776639479957",
      targetBranch: "master",
      isFastForward: false,
    });

    expect(result.reason).toContain("master");
  });

  it("should validate result with ShadowBranchMergeResultSchema", () => {
    const result = validateShadowBranchMerge({
      shadowBranch: "ai-shadow/node_abc-1776639479957",
      targetBranch: "master",
      isFastForward: false,
    });

    const parsed = ShadowBranchMergeResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
