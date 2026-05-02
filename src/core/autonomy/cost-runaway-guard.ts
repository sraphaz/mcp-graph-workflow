/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B5 — Cost runaway pause guard.
 * Hook handler para cost:budget_exceeded: pausa autopilot, marca sprint
 * como blocked (best-effort) e emite approval:required. Idempotente — chamar
 * já pausado não falha. Backstop ao EventReactor (B4 do Sprint 1).
 *
 * Toggle: env MCP_GRAPH_COST_RUNAWAY_GUARD=off desabilita.
 */

import type Database from "better-sqlite3";

export interface CostRunawayPayload {
  sprintId?: string;
  totalUsd: number;
  capUsd: number;
  scope?: "run" | "cell";
}

export interface CostRunawayDeps {
  env: NodeJS.ProcessEnv;
  db?: Database.Database;
  emitEvent?: (event: string, payload: Record<string, unknown>) => void;
  logError?: (msg: string, ctx: Record<string, unknown>) => void;
}

export interface CostRunawayResult {
  paused: boolean;
  alreadyPaused: boolean;
  sprintBlocked: boolean;
  approvalEmitted: boolean;
  skipped: "disabled" | undefined;
}

/** isCostRunawayGuardDisabled — auto-generated description placeholder. */
export function isCostRunawayGuardDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_COST_RUNAWAY_GUARD === "off";
}

/** Idempotently pause autopilot via env flag, mark sprint blocked, emit approval. */
export function handleCostRunaway(
  payload: CostRunawayPayload,
  deps: CostRunawayDeps,
): CostRunawayResult {
  if (isCostRunawayGuardDisabled(deps.env)) {
    return {
      paused: false,
      alreadyPaused: false,
      sprintBlocked: false,
      approvalEmitted: false,
      skipped: "disabled",
    };
  }

  const alreadyPaused = deps.env.MCP_GRAPH_AUTOPILOT_PAUSED === "true";
  deps.env.MCP_GRAPH_AUTOPILOT_PAUSED = "true";

  let sprintBlocked = false;
  if (deps.db && payload.sprintId) {
    try {
      const info = deps.db
        .prepare(`UPDATE sprints SET status = 'blocked' WHERE id = ? AND status != 'blocked'`)
        .run(payload.sprintId);
      sprintBlocked = info.changes > 0;
    } catch {
      // Sprint table may not exist in test envs — best-effort, do not throw.
    }
  }

  let approvalEmitted = false;
  if (deps.emitEvent) {
    deps.emitEvent("approval:required", {
      reason: "cost_runaway",
      sprintId: payload.sprintId,
      totalUsd: payload.totalUsd,
      capUsd: payload.capUsd,
      scope: payload.scope ?? "run",
    });
    approvalEmitted = true;
  }

  deps.logError?.("hook:cost:runaway-pause", {
    sprintId: payload.sprintId,
    totalUsd: payload.totalUsd,
    capUsd: payload.capUsd,
    alreadyPaused,
  });

  return { paused: true, alreadyPaused, sprintBlocked, approvalEmitted, skipped: undefined };
}
