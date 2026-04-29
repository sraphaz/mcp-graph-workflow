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
}

export interface BudgetCaps {
  capUsdPerCell?: number;
  capUsdPerRun?: number;
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
  /** §EPIC-16.2 — provider that ultimately answered (after failover hops). */
  providerUsed?: string;
  /** §EPIC-16.2 — number of failover hops taken before this row was recorded. */
  fallbackCount?: number;
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
  }

  record(row: LedgerRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO llm_call_ledger (
        id, ts, project_id, cell_id, run_id, node_id, caller, provider, model,
        input_tokens, output_tokens, cached_input_tokens, cache_creation_tokens,
        cost_usd, latency_ms, status, error_kind, provider_used, fallback_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    for (const r of rows) {
      byProvider[r.provider] = r.total;
      totalUsd += r.total;
      callCount += r.calls;
    }
    return { totalUsd, callCount, byProvider };
  }
}
