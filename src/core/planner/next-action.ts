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
 * Agent State Machine — computes the recommended next action after each tool call.
 * Pure function, no side effects, easy to test.
 * Appended to _lifecycle block in lifecycle-wrapper.ts.
 */

import type { LifecyclePhase } from "./lifecycle-phase.js";

export interface NextAction {
  tool: string;
  args?: Record<string, unknown>;
  reason: string;
  priority: "required" | "recommended" | "optional";
  hint?: string;
}

const READ_ONLY_TOOLS = new Set([
  "list", "show", "search", "help", "metrics", "context", "knowledge",
  "export", "code_intelligence",
  "list_memories", "read_memory", "manage_skill",
]);

/**
 * Compute what the agent should do next based on the tool that just executed.
 * Returns null when no specific action is recommended (agent decides freely).
 */
export function computeNextAction(
  toolName: string,
  toolArgs: Record<string, unknown>,
  phase: LifecyclePhase,
  toolResult?: Record<string, unknown>,
): NextAction | null {
  // Read-only tools don't drive workflow
  if (READ_ONLY_TOOLS.has(toolName)) return null;

  // ── Pipeline tools ──
  if (toolName === "start_task") {
    // Agent implements — no forced next action
    return null;
  }

  if (toolName === "finish_task") {
    const status = toolResult?.status as string | undefined;
    if (status === "blocked") {
      const blockers = (toolResult?.blockers as string[]) ?? [];
      return {
        tool: "fix",
        reason: "DoD checks failed — fix blockers before retrying",
        priority: "required",
        hint: `Fix blockers: ${blockers.join("; ")}`,
      };
    }
    return {
      tool: "start_task",
      reason: "Task done — start next task",
      priority: "recommended",
    };
  }

  // ── ANALYZE phase ──
  if (toolName === "import_prd") {
    return {
      tool: "analyze",
      args: { mode: "prd_quality" },
      reason: "PRD imported — validate quality before planning",
      priority: "recommended",
    };
  }

  if (toolName === "analyze") {
    const mode = toolArgs.mode as string | undefined;
    if (mode === "prd_quality") {
      return { tool: "plan_sprint", reason: "PRD validated — plan sprint", priority: "recommended" };
    }
    if (mode === "design_ready") {
      return { tool: "set_phase", args: { mode: "PLAN" }, reason: "Design ready — transition to PLAN", priority: "recommended" };
    }
    if (mode === "review_ready") {
      return { tool: "export", reason: "Review ready — export graph for handoff", priority: "recommended" };
    }
    if (mode === "handoff_ready") {
      return { tool: "snapshot", reason: "Handoff ready — create snapshot", priority: "recommended" };
    }
    if (mode === "deploy_ready") {
      return { tool: "set_phase", args: { mode: "DEPLOY" }, reason: "Deploy ready", priority: "recommended" };
    }
    return null;
  }

  // ── PLAN phase ──
  if (toolName === "plan_sprint") {
    return { tool: "sync_stack_docs", reason: "Sprint planned — sync library docs", priority: "recommended" };
  }
  if (toolName === "sync_stack_docs") {
    return { tool: "start_task", reason: "Docs synced — start implementing", priority: "recommended" };
  }

  // ── IMPLEMENT phase ──
  if (toolName === "update_status") {
    const status = toolArgs.status as string | undefined;
    if (status === "done") {
      return { tool: "start_task", reason: "Task done — start next task", priority: "recommended" };
    }
    return null;
  }

  // ── DESIGN phase ──
  if (phase === "DESIGN" && (toolName === "node" || toolName === "edge")) {
    return {
      tool: "analyze",
      args: { mode: "design_ready" },
      reason: "Design updated — check readiness gate",
      priority: "recommended",
    };
  }

  // ── VALIDATE phase ──
  if (toolName === "set_phase") {
    const targetPhase = toolArgs.mode as string | undefined;
    if (targetPhase === "VALIDATE") {
      return { tool: "validate", args: { action: "ac" }, reason: "Entered VALIDATE — check AC", priority: "recommended" };
    }
    if (targetPhase === "IMPLEMENT") {
      return { tool: "start_task", reason: "Entered IMPLEMENT — start first task", priority: "recommended" };
    }
    return null;
  }

  // ── HANDOFF phase ──
  if (toolName === "snapshot") {
    if (phase === "HANDOFF") {
      return { tool: "write_memory", reason: "Snapshot created — capture knowledge", priority: "recommended" };
    }
    return null;
  }

  return null;
}
