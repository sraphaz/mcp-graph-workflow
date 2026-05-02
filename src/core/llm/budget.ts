/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — BudgetLedger.
 * Pre-flight guard + post-call record + scope aggregation against `llm_call_ledger`.
 * Concurrency: SQLite single-writer naturally serializes; overshoot ≤1 call accepted (ADR-llm-04).
 */

import type Database from "better-sqlite3";
import { LlmBudgetExceededError } from "./errors.js";
import type { LlmUsage, ProviderName } from "./types.js";

export interface BudgetScopeRef {
  cellId?: string;
  runId?: string;
  /** §extracta-cost-observability — session-scope aggregation. */
  sessionId?: string;
}

export interface BudgetCaps {
  capUsdPerCell?: number;
  capUsdPerRun?: number;
  /** §extracta-cost-observability — session cap (across cells + runs). */
  capUsdPerSession?: number;
  /**
   * §extracta-cost-observability — soft-cap fraction (0..1) of the session
   * cap. When current ≥ soft-cap, the gateway downgrades to a cheaper-tier
   * model instead of throwing. Defaults to 0.5.
   */
  softCapFraction?: number;
}

export interface BudgetAggregate {
  totalUsd: number;
  callCount: number;
  byProvider: Record<string, number>;
}

export interface LedgerRow {
  caller: string;
  provider: ProviderName | string;
  model: string;
  usage: LlmUsage;
  costUsd: number;
  latencyMs: number;
  status: "ok" | "error";
  errorKind?: string;
  cellId?: string;
  runId?: string;
  /** Graph node ID for per-task cost attribution (EPIC 11). */
  nodeId?: string;
  /** §extracta-cost-observability — session ID for session-scoped aggregation. */
  sessionId?: string;
  /** §EPIC-16.2 — provider that ultimately answered (after failover hops). */
  providerUsed?: string;
  /** §EPIC-16.2 — number of failover hops taken before this row was recorded. */
  fallbackCount?: number;
}

/**
 * §extracta-cost-observability — read budget caps from env vars so the
 * gateway can be configured without hard-coding values. Recognized:
 *   MCP_GRAPH_SESSION_BUDGET_USD     — hard cap (throws when exceeded)
 *   MCP_GRAPH_SESSION_SOFT_FRACTION  — soft-cap fraction in [0,1] (default 0.5)
 *   MCP_GRAPH_CELL_BUDGET_USD        — per-cell hard cap
 *   MCP_GRAPH_RUN_BUDGET_USD         — per-run hard cap
 * Invalid / non-finite values are dropped silently.
 */
export function budgetCapsFromEnv(env: NodeJS.ProcessEnv = process.env): BudgetCaps {
  const caps: BudgetCaps = {};
  const session = Number(env.MCP_GRAPH_SESSION_BUDGET_USD);
  if (Number.isFinite(session) && session > 0) caps.capUsdPerSession = session;
  const cell = Number(env.MCP_GRAPH_CELL_BUDGET_USD);
  if (Number.isFinite(cell) && cell > 0) caps.capUsdPerCell = cell;
  const run = Number(env.MCP_GRAPH_RUN_BUDGET_USD);
  if (Number.isFinite(run) && run > 0) caps.capUsdPerRun = run;
  const soft = Number(env.MCP_GRAPH_SESSION_SOFT_FRACTION);
  if (Number.isFinite(soft) && soft > 0 && soft <= 1) caps.softCapFraction = soft;
  return caps;
}

function ulid(): string {
  // Lightweight ulid-ish id: ts(ms) base36 + 10 random base36 chars.
  const ts = Date.now().toString(36).padStart(9, "0");
  const rand = Math.random().toString(36).slice(2, 12).padStart(10, "0");
  return `ll_${ts}${rand}`;
}

export class BudgetLedger {
  constructor(
    private readonly db: Database.Database,
    private readonly projectId: string,
  ) {}

  guard(scope: BudgetScopeRef, estimatedUsd: number, caps: BudgetCaps): void {
    if (scope.cellId && caps.capUsdPerCell !== undefined && Number.isFinite(caps.capUsdPerCell)) {
      const current = this.aggregate({ cellId: scope.cellId }).totalUsd;
      if (current + estimatedUsd > caps.capUsdPerCell) {
        throw new LlmBudgetExceededError({
          scope: "cell",
          scopeId: scope.cellId,
          currentUsd: current + estimatedUsd,
          capUsd: caps.capUsdPerCell,
        });
      }
    }
    if (scope.runId && caps.capUsdPerRun !== undefined && Number.isFinite(caps.capUsdPerRun)) {
      const current = this.aggregate({ runId: scope.runId }).totalUsd;
      if (current + estimatedUsd > caps.capUsdPerRun) {
        throw new LlmBudgetExceededError({
          scope: "run",
          scopeId: scope.runId,
          currentUsd: current + estimatedUsd,
          capUsd: caps.capUsdPerRun,
        });
      }
    }
    if (scope.sessionId && caps.capUsdPerSession !== undefined && Number.isFinite(caps.capUsdPerSession)) {
      const current = this.aggregate({ sessionId: scope.sessionId }).totalUsd;
      if (current + estimatedUsd > caps.capUsdPerSession) {
        throw new LlmBudgetExceededError({
          scope: "session",
          scopeId: scope.sessionId,
          currentUsd: current + estimatedUsd,
          capUsd: caps.capUsdPerSession,
        });
      }
    }
  }

  /**
   * §extracta-cost-observability — returns true when session spend has
   * crossed the soft-cap fraction (default 0.5) of the session cap. The
   * gateway uses this to auto-downgrade to a cheaper model BEFORE the hard
   * cap throws.
   */
  isSessionSoftCapped(scope: BudgetScopeRef, caps: BudgetCaps): boolean {
    if (!scope.sessionId) return false;
    if (caps.capUsdPerSession === undefined || !Number.isFinite(caps.capUsdPerSession)) return false;
    const fraction = caps.softCapFraction ?? 0.5;
    const current = this.aggregate({ sessionId: scope.sessionId }).totalUsd;
    return current >= caps.capUsdPerSession * fraction;
  }

  record(row: LedgerRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO llm_call_ledger (
        id, ts, project_id, cell_id, run_id, node_id, caller, provider, model,
        input_tokens, output_tokens, cached_input_tokens, cache_creation_tokens,
        cost_usd, latency_ms, status, error_kind, provider_used, fallback_count,
        session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((r: LedgerRow) => {
      stmt.run(
        ulid(),
        Date.now(),
        this.projectId,
        r.cellId ?? null,
        r.runId ?? null,
        r.nodeId ?? null,
        r.caller,
        r.provider,
        r.model,
        r.usage.inputTokens,
        r.usage.outputTokens,
        r.usage.cachedInputTokens ?? null,
        r.usage.cacheCreationInputTokens ?? null,
        r.costUsd,
        r.latencyMs,
        r.status,
        r.errorKind ?? null,
        r.providerUsed ?? null,
        r.fallbackCount ?? 0,
        r.sessionId ?? null,
      );
    });
    tx(row);
  }

  aggregate(scope: BudgetScopeRef): BudgetAggregate {
    const where: string[] = ["project_id = ?"];
    const params: unknown[] = [this.projectId];
    if (scope.cellId) {
      where.push("cell_id = ?");
      params.push(scope.cellId);
    }
    if (scope.runId) {
      where.push("run_id = ?");
      params.push(scope.runId);
    }
    if (scope.sessionId) {
      where.push("session_id = ?");
      params.push(scope.sessionId);
    }
    const sql = `
      SELECT provider, COALESCE(SUM(cost_usd), 0) AS total, COUNT(*) AS calls
      FROM llm_call_ledger
      WHERE ${where.join(" AND ")}
      GROUP BY provider
    `;
    const rows = this.db.prepare(sql).all(...params) as Array<{
      provider: string;
      total: number;
      calls: number;
    }>;
    const byProvider: Record<string, number> = {};
    let totalUsd = 0;
    let callCount = 0;
    for (const rVar of rows) {
      byProvider[rVar.provider] = rVar.total;
      totalUsd += rVar.total;
      callCount += rVar.calls;
    }
    return { totalUsd, callCount, byProvider };
  }
}
