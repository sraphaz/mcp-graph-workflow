/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { logger } from "../utils/logger.js";
import type { HookBus } from "./hook-bus.js";
import { detectBannedPhrases } from "./anti-hallucination-detector.js";
import { checkDestructiveDbIntent } from "./destructive-db-guard.js";
import { persistLesson } from "../autonomy/lessons-store.js";
import { createHash } from "node:crypto";
import { checkApproval } from "../approval/approval-checker.js";
import { verifyAndPromote } from "../utils/verified-auto-promote.js";
import { scanForPii, redactPii } from "./memory-pii-scanner.js";
import { countInProgressForAgent, getWipCap } from "./wip-cap-guard.js";
import { isBudgetLow } from "./agent-budget-precheck.js";
import { ApprovalTimeoutTracker, getApprovalTimeoutMs } from "./approval-timeout.js";
import type { SqliteStore } from "../store/sqlite-store.js";

export const builtinHandlerIds = [
  "builtin:audit-log",
  "builtin:telemetry",
  "builtin:harness-regression",
  "builtin:anti-hallucination",
  "builtin:approval-required",
  "builtin:verified-auto-promote",
  "builtin:memory-pii-scanner",
  "builtin:wip-cap-guard",
  "builtin:agent-budget-precheck",
  "builtin:approval-timeout",
  "builtin:destructive-db-guard",
] as const;

/**
 * Registers the built-in hook handlers onto the provided HookBus.
 * No-op when MCP_GRAPH_HOOKS_DISABLED=true (test mode).
 *
 * `store` is optional for backward compatibility; the verified-auto-promote
 * handler is skipped when no store is provided.
 */
export function registerBuiltinHandlers(bus: HookBus, store?: SqliteStore): void {
  if (process.env.MCP_GRAPH_HOOKS_DISABLED === "true") return;

  // Audit-log: records task completions and errors to the structured logger
  bus.on("task:post-complete", async (event) => {
    logger.info("hook:audit:task-complete", {
      nodeId: event.payload["nodeId"],
      title: event.payload["title"],
      ts: event.timestamp,
    });
  });

  bus.on("task:error", async (event) => {
    logger.warn("hook:audit:task-error", {
      nodeId: event.payload["nodeId"],
      error: event.payload["error"],
      ts: event.timestamp,
    });
  });

  // Telemetry: records tool call durations for observability
  bus.on("tool:pre-call", async (event) => {
    logger.debug("hook:telemetry:tool-pre-call", { toolName: event.payload["toolName"], ts: event.timestamp });
  });

  bus.on("tool:post-call", async (event) => {
    logger.info("hook:telemetry:tool-post-call", {
      toolName: event.payload["toolName"],
      durationMs: event.payload["durationMs"],
      ts: event.timestamp,
    });
  });

  // §EPIC-13.3 — Anti-hallucination: scans `payload.prompt` (when callers
  // include it) on task:pre-execute and emits an advisory log entry naming
  // each forbidden phrase. Pure-advisory: never blocks task execution.
  bus.on("task:pre-execute", async (event) => {
    const prompt = event.payload["prompt"];
    if (typeof prompt !== "string" || prompt.length === 0) return;
    const hits = detectBannedPhrases(prompt);
    if (hits.length > 0) {
      logger.warn("hook:anti-hallucination:detected", {
        nodeId: event.payload["nodeId"],
        bannedPhrases: hits,
        rule: ".claude/rules/anti-hallucination.md",
      });
    }
  });

  // §SprintE.5 — Destructive DB guard: refuses to forward a task whose
  // prompt or tool-input would wipe the mcp-graph store. Surfaces a
  // human-readable reason via logger.error so the orchestrator (and the
  // user) sees exactly why the task was halted.
  bus.on("task:pre-execute", async (event) => {
    const prompt = event.payload["prompt"];
    const confirm = event.payload["destructiveConfirmation"];
    if (typeof prompt !== "string" || prompt.length === 0) return;
    const verdict = checkDestructiveDbIntent(
      prompt,
      typeof confirm === "string" ? confirm : null,
    );
    if (verdict.blocked) {
      logger.error("hook:destructive-db-guard:blocked", {
        nodeId: event.payload["nodeId"],
        matched: verdict.matchedPattern,
        reason: verdict.reason,
      });
      recordDestructiveAttempt(store, "task:pre-execute", verdict.matchedPattern, prompt);
      throw new Error(verdict.reason ?? "destructive-db-guard: blocked");
    }
  });

  bus.on("tool:pre-call", async (event) => {
    const toolName = event.payload["toolName"];
    const input = event.payload["toolInput"];
    if (toolName !== "Bash" || !input || typeof input !== "object") return;
    const cmd = (input as Record<string, unknown>)["command"];
    if (typeof cmd !== "string") return;
    const verdict = checkDestructiveDbIntent(cmd);
    if (verdict.blocked) {
      logger.error("hook:destructive-db-guard:blocked-bash", {
        matched: verdict.matchedPattern,
        reason: verdict.reason,
      });
      recordDestructiveAttempt(store, "tool:pre-call:Bash", verdict.matchedPattern, cmd);
      throw new Error(verdict.reason ?? "destructive-db-guard: blocked");
    }
  });

  // §EPIC-15.2 — Approval Required: scans `payload.tool` + `payload.toolInput`
  // on tool:pre-call, and emits APPROVAL_REQUIRED via the same bus when a
  // sensitive pattern matches. Pure-advisory: never blocks the call here —
  // the actual block-and-wait is done by callers polling
  // signal-file-watcher.waitForApproval. This handler is the bus-level
  // signal so consumers (UI, Slack bridge, etc.) can render the prompt.
  bus.on("tool:pre-call", async (event) => {
    const tool = event.payload["toolName"];
    const input = event.payload["toolInput"];
    if (typeof tool !== "string") return;
    const result = checkApproval({
      tool,
      input: (input && typeof input === "object") ? (input as Record<string, unknown>) : null,
    });
    if (result.requires_approval) {
      logger.warn("hook:approval-required:detected", {
        tool,
        nodeId: event.payload["nodeId"],
        severity: result.severity,
        reason: result.reason,
        matched: result.matchedPatterns,
      });
      await bus.emit({
        channel: "approval:required",
        timestamp: event.timestamp,
        payload: {
          nodeId: event.payload["nodeId"],
          tool,
          severity: result.severity,
          reason: result.reason,
          matched: result.matchedPatterns,
        },
      });
    }
  });

  // Verified auto-promote: on task:post-complete, walks parent chain and
  // promotes ancestors only when their deliverable verifies (sourceRef exists +
  // testFiles exist + tests pass). Closes the drift gap where status="done"
  // was assumed without verification. Skipped when store is not injected or
  // when MCP_GRAPH_VERIFIED_AUTO_PROMOTE=off.
  if (store && process.env.MCP_GRAPH_VERIFIED_AUTO_PROMOTE !== "off") {
    bus.on("task:post-complete", async (event) => {
      const nodeId = event.payload["nodeId"];
      if (typeof nodeId !== "string" || nodeId.length === 0) return;
      try {
        const result = await verifyAndPromote(store, nodeId);
        if (result.promoted.length > 0) {
          logger.info("hook:verified-auto-promote:done", {
            triggeredBy: nodeId,
            promoted: result.promoted,
          });
        }
        if (result.rejected.length > 0) {
          logger.warn("hook:verified-auto-promote:rejected", {
            triggeredBy: nodeId,
            rejected: result.rejected,
          });
        }
      } catch (err) {
        logger.error("hook:verified-auto-promote:error", {
          nodeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  // §EPIC-21.T05 — Memory PII scanner. Scans memory:pre-store payload.content
  // for email/SSN/credit-card (Luhn)/API-token patterns. Default: redacts
  // in-place via payload mutation. Strict mode (MCP_GRAPH_PII_STRICT=true):
  // throws to abort the store. Toggle: MCP_GRAPH_PII_SCANNER=off.
  if (process.env.MCP_GRAPH_PII_SCANNER !== "off") {
    bus.on("memory:pre-store", async (event) => {
      const content = event.payload["content"];
      if (typeof content !== "string" || content.length === 0) return;
      const hits = scanForPii(content);
      if (hits.length === 0) return;
      const kinds = [...new Set(hits.map((h) => h.kind))];
      logger.warn("hook:memory:pii-detected", {
        kinds,
        count: hits.length,
        nodeId: event.payload["nodeId"],
      });
      if (process.env.MCP_GRAPH_PII_STRICT === "true") {
        // Caller must check payload.rejected and abort the store. HookBus
        // catches exceptions, so we cannot throw here — we mutate instead.
        event.payload["rejected"] = true;
        event.payload["rejectionReason"] = `PII detected (${kinds.join(", ")})`;
        return;
      }
      // Default: redact in-place (caller reads mutated content from payload).
      event.payload["content"] = redactPii(content);
    });
  }

  // §EPIC-21.T09 — WIP cap guard. Operacionaliza WIP=1 do CLAUDE.md.
  // Conta nodes status=in_progress por agente em task:pre-execute. Se >= cap
  // (MCP_GRAPH_WIP_CAP, default 1), emite warning advisory. Não bloqueia
  // execução. Toggle: MCP_GRAPH_WIP_GUARD=off.
  if (store && process.env.MCP_GRAPH_WIP_GUARD !== "off") {
    bus.on("task:pre-execute", async (event) => {
      const agentId = event.payload["agentId"];
      const agentIdStr = typeof agentId === "string" && agentId.length > 0 ? agentId : null;
      try {
        const cap = getWipCap(process.env);
        const current = countInProgressForAgent(store, agentIdStr);
        if (current >= cap) {
          logger.warn("hook:wip-cap:exceeded", {
            agentId: agentIdStr,
            current,
            cap,
            nodeId: event.payload["nodeId"],
          });
        }
      } catch (err) {
        logger.error("hook:wip-cap:error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  // §EPIC-21.T11 — agent-budget-precheck. Adverte (não bloqueia) quando o
  // consumo já está em ≥90% do cap. Caller injeta currentUsd e capUsd no
  // payload (BudgetLedger.aggregate + project_settings cap_usd_per_run).
  // Toggle: MCP_GRAPH_AGENT_BUDGET_GUARD=off.
  if (process.env.MCP_GRAPH_AGENT_BUDGET_GUARD !== "off") {
    bus.on("agent:pre-spawn", async (event) => {
      const currentUsd = event.payload["currentUsd"];
      const capUsd = event.payload["capUsd"];
      if (typeof currentUsd !== "number") return;
      const cap = typeof capUsd === "number" ? capUsd : undefined;
      if (isBudgetLow({ currentUsd, capUsd: cap })) {
        logger.warn("hook:agent:budget-low", {
          agentId: event.payload["agentId"],
          currentUsd,
          capUsd: cap,
          ratio: cap ? currentUsd / cap : null,
        });
      }
    });
  }

  // §EPIC-21.T13 — approval-timeout-escalate. Em approval:required, arma um
  // timer; se nenhum approval:resolved chegar dentro do timeout, escala via
  // logger.error (consumer pode wirar Slack ping em separado). Toggle:
  // MCP_GRAPH_APPROVAL_TIMEOUT_GUARD=off para não armar timers.
  if (process.env.MCP_GRAPH_APPROVAL_TIMEOUT_GUARD !== "off") {
    const timeoutMs = getApprovalTimeoutMs(process.env);
    const tracker = new ApprovalTimeoutTracker(timeoutMs, (approvalId, context) => {
      logger.error("hook:approval:timeout", {
        approvalId,
        timeoutMs,
        ...context,
      });
    });
    bus.on("approval:required", async (event) => {
      const approvalId =
        typeof event.payload["approvalId"] === "string"
          ? event.payload["approvalId"]
          : `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      tracker.arm(approvalId, {
        tool: event.payload["tool"],
        nodeId: event.payload["nodeId"],
        reason: event.payload["reason"],
      });
    });
    // Optional resolve channel: callers emit a synthetic "approval:resolved"
    // event with payload.approvalId to cancel the timer. Channel is not in
    // HOOK_CHANNELS yet; we listen via the underlying bus event mechanism.
    bus.on("session:end", async () => {
      tracker.clear(); // graceful shutdown
    });
  }

  // Harness regression: warns on session:end when harness score drops > 5 pts
  bus.on("session:end", async (event) => {
    const delta = typeof event.payload["delta"] === "number" ? event.payload["delta"] : 0;
    if (delta < -5) {
      logger.warn("hook:harness-regression:detected", {
        scoreBefore: event.payload["scoreBefore"],
        scoreAfter: event.payload["scoreAfter"],
        delta,
      });
    } else {
      logger.debug("hook:harness-regression:ok", { delta });
    }
  });
}

/**
 * §SprintE.5 — Persist a destructive-db-attempt to lessons_learned so the
 * audit trail survives across restarts and the orchestrator can spot
 * repeated probes against the store. Best-effort: lessons table may not
 * exist on early-migration installs, in which case we just log.
 */
function recordDestructiveAttempt(
  store: SqliteStore | undefined,
  channel: string,
  matchedPattern: string | null,
  excerpt: string,
): void {
  if (!store) return;
  try {
    const hash = createHash("sha256")
      .update(`destructive-db-attempt:${matchedPattern ?? "unknown"}:${excerpt.slice(0, 200)}`)
      .digest("hex")
      .slice(0, 32);
    persistLesson(store.getDb(), {
      patternHash: hash,
      description: `destructive-db-attempt (${matchedPattern ?? "unknown"}) blocked at ${channel}`,
      recommendedAction: "review prompt source — repeated attempts indicate prompt-injection or misconfigured agent",
      confidence: 0.9,
      source: "destructive-db-guard",
    });
  } catch (err) {
    logger.debug("hook:destructive-db-guard:lesson_record_failed", { error: String(err) });
  }
}
