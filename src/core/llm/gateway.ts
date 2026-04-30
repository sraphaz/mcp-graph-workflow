/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — LlmGateway facade (ADR-llm-01).
 * Routes by model id → ProviderAdapter; pre-flight budget guard + post-call ledger record.
 */

import type { ProviderAdapter } from "./adapters/base.js";
import type { BudgetCaps, BudgetScopeRef, BudgetLedger, BudgetAggregate } from "./budget.js";
import { LlmModelUnknown } from "./errors.js";
import { calcCost } from "./pricing.js";
import type { ModelRegistry, RegistryListOptions } from "./registry.js";
import type { CallContext, LlmRequest, LlmResponse, ModelSpec, ProviderName } from "./types.js";
import { LlmCircuitBreaker, isCircuitOpenStatus, type CircuitState } from "./circuit-breaker-llm.js";
import type { FailoverEntry } from "./failover-chain.js";

export interface LlmGatewayOptions {
  registry: ModelRegistry;
  budget: BudgetLedger;
  adapters: Map<ProviderName, ProviderAdapter>;
  /** Default policy: false → tier='expensive' models rejected at lookup time. */
  allowExpensive?: boolean;
  /** Default caps applied when generate() does not pass explicit caps. */
  defaultCaps?: BudgetCaps;
  /** §EPIC-16.1 — ordered failover chain tried when complete() hits retriable errors. */
  failoverChain?: ReadonlyArray<FailoverEntry>;
  /** §EPIC-16.1 — circuit breaker shared across calls (per-provider). */
  circuitBreaker?: LlmCircuitBreaker;
}

export interface FailoverProviderStatus {
  provider: string;
  model: string;
  state: CircuitState;
}

export class LlmGateway {
  private readonly registry: ModelRegistry;
  private readonly budget: BudgetLedger;
  private readonly adapters: Map<ProviderName, ProviderAdapter>;
  private readonly allowExpensive: boolean;
  private readonly defaultCaps: BudgetCaps;
  private readonly failoverChain: ReadonlyArray<FailoverEntry>;
  private readonly circuitBreaker: LlmCircuitBreaker | null;

  constructor(opts: LlmGatewayOptions) {
    this.registry = opts.registry;
    this.budget = opts.budget;
    this.adapters = opts.adapters;
    this.allowExpensive = opts.allowExpensive ?? true;
    this.defaultCaps = opts.defaultCaps ?? {};
    this.failoverChain = opts.failoverChain ?? [];
    this.circuitBreaker = opts.circuitBreaker ?? null;
  }

  async generate(
    req: LlmRequest,
    ctx: CallContext,
    caps?: BudgetCaps,
  ): Promise<LlmResponse> {
    const spec = this.registry.lookupModel(req.model);
    if (!this.allowExpensive && spec.tier === "expensive") {
      throw new LlmModelUnknown(`${req.model} (tier=expensive blocked by policy)`);
    }

    const adapter = this.adapters.get(spec.provider);
    if (!adapter) {
      throw new LlmModelUnknown(`${req.model} (no adapter registered for provider=${spec.provider})`);
    }

    const effectiveCaps = caps ?? this.defaultCaps;
    const scope: BudgetScopeRef = { cellId: ctx.cellId, runId: ctx.runId, sessionId: ctx.sessionId };
    // Pre-flight estimate: assume worst-case output (req.maxTokens or default 1024)
    // priced at the model's output rate. Real usage replaces this in the post-call record.
    const estimateOutput = req.maxTokens ?? 1024;
    const estimateUsd = (estimateOutput / 1_000_000) * spec.pricing.outputPerMtok;
    this.budget.guard(scope, estimateUsd, effectiveCaps);

    const t0 = Date.now();
    try {
      const response = await adapter.generate(req);
      const cost = calcCost(response.usage, spec);
      this.budget.record({
        caller: ctx.caller,
        provider: spec.provider,
        model: req.model,
        usage: response.usage,
        costUsd: cost,
        latencyMs: Date.now() - t0,
        status: "ok",
        cellId: ctx.cellId,
        runId: ctx.runId,
        sessionId: ctx.sessionId,
      });
      return response;
    } catch (err) {
      this.budget.record({
        caller: ctx.caller,
        provider: spec.provider,
        model: req.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        latencyMs: Date.now() - t0,
        status: "error",
        errorKind: err instanceof Error ? err.name : "unknown",
        cellId: ctx.cellId,
        runId: ctx.runId,
        sessionId: ctx.sessionId,
      });
      throw err;
    }
  }

  /**
   * Like generate() but accepts an optional streamDelta callback and a
   * §EPIC-16.2 failover chain. When the primary call fails with a retriable
   * status (401/402/429/5xx), each subsequent chain entry is attempted in
   * order. The ledger row of the successful attempt records `provider_used`
   * and `fallback_count` (= number of retries before this one succeeded).
   *
   * v1 streaming: single-chunk simulation — streamDelta(content) then null.
   */
  async complete(
    req: LlmRequest,
    ctx: CallContext,
    opts: { streamDelta?: (chunk: string | null) => void; caps?: BudgetCaps } = {},
  ): Promise<LlmResponse> {
    const primaryProvider = this.registry.lookupModel(req.model).provider;
    const effectiveCaps = opts.caps ?? this.defaultCaps;
    const scope: BudgetScopeRef = { cellId: ctx.cellId, runId: ctx.runId, sessionId: ctx.sessionId };

    // §extracta-cost-observability — when session spend has crossed the
    // soft-cap, skip the (potentially expensive) primary and start the
    // attempt sequence from the failover chain (presumed cheaper).
    const softCapped = this.budget.isSessionSoftCapped(scope, effectiveCaps);

    const attempts: Array<{ provider: string; model: string }> = [];
    if (!softCapped) {
      attempts.push({ provider: primaryProvider, model: req.model });
    }
    for (const entry of this.failoverChain) {
      if (entry.provider === primaryProvider && entry.model === req.model) continue;
      attempts.push({ provider: entry.provider, model: entry.model });
    }
    if (attempts.length === 0) {
      // No failover entries to fall back to even when soft-capped — fall
      // through to primary, which will throw via budget.guard if hard cap
      // is also exceeded.
      attempts.push({ provider: primaryProvider, model: req.model });
    }

    let lastErr: unknown = null;
    for (let hop = 0; hop < attempts.length; hop++) {
      const { provider, model } = attempts[hop];
      if (this.circuitBreaker && !this.circuitBreaker.canCall(provider)) {
        // Circuit open — skip this provider entirely, no ledger row.
        continue;
      }
      try {
        const response = await this.generateWithProvenance(
          { ...req, model },
          ctx,
          opts.caps,
          { providerUsed: provider, fallbackCount: hop },
        );
        this.circuitBreaker?.recordSuccess(provider);
        if (opts.streamDelta) {
          opts.streamDelta(response.content);
          opts.streamDelta(null);
        }
        return response;
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number } | undefined)?.status;
        if (typeof status === "number") {
          this.circuitBreaker?.recordFailure(provider, status);
          if (!isCircuitOpenStatus(status)) {
            // Non-retriable error — bail out instead of trying chain.
            throw err;
          }
        }
        // Try next attempt
      }
    }
    throw lastErr ?? new Error("LlmGateway.complete: all failover attempts failed");
  }

  /**
   * Internal: same as generate() but stamps the ledger row with the failover
   * provenance fields (provider_used + fallback_count) §EPIC-16.2.
   */
  private async generateWithProvenance(
    req: LlmRequest,
    ctx: CallContext,
    caps: BudgetCaps | undefined,
    provenance: { providerUsed: string; fallbackCount: number },
  ): Promise<LlmResponse> {
    const spec = this.registry.lookupModel(req.model);
    if (!this.allowExpensive && spec.tier === "expensive") {
      throw new LlmModelUnknown(`${req.model} (tier=expensive blocked by policy)`);
    }
    const adapter = this.adapters.get(spec.provider);
    if (!adapter) {
      throw new LlmModelUnknown(`${req.model} (no adapter registered for provider=${spec.provider})`);
    }
    const effectiveCaps = caps ?? this.defaultCaps;
    const scope: BudgetScopeRef = { cellId: ctx.cellId, runId: ctx.runId, sessionId: ctx.sessionId };
    const estimateOutput = req.maxTokens ?? 1024;
    const estimateUsd = (estimateOutput / 1_000_000) * spec.pricing.outputPerMtok;
    this.budget.guard(scope, estimateUsd, effectiveCaps);

    const t0 = Date.now();
    try {
      const response = await adapter.generate(req);
      const cost = calcCost(response.usage, spec);
      this.budget.record({
        caller: ctx.caller,
        provider: spec.provider,
        model: req.model,
        usage: response.usage,
        costUsd: cost,
        latencyMs: Date.now() - t0,
        status: "ok",
        cellId: ctx.cellId,
        runId: ctx.runId,
        sessionId: ctx.sessionId,
        providerUsed: provenance.providerUsed,
        fallbackCount: provenance.fallbackCount,
      });
      return response;
    } catch (err) {
      this.budget.record({
        caller: ctx.caller,
        provider: spec.provider,
        model: req.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        latencyMs: Date.now() - t0,
        status: "error",
        errorKind: err instanceof Error ? err.name : "unknown",
        cellId: ctx.cellId,
        runId: ctx.runId,
        sessionId: ctx.sessionId,
        providerUsed: spec.provider,
        fallbackCount: provenance.fallbackCount,
      });
      throw err;
    }
  }

  /** §EPIC-16.2 — circuit-breaker state per chain entry. */
  failoverStatus(): FailoverProviderStatus[] {
    return this.failoverChain.map((entry) => ({
      provider: entry.provider,
      model: entry.model,
      state: this.circuitBreaker ? this.circuitBreaker.state(entry.provider) : "closed",
    }));
  }

  listModels(opts: RegistryListOptions = {}): ModelSpec[] {
    const allowExpensive = opts.allowExpensive ?? this.allowExpensive;
    return this.registry.list({ ...opts, allowExpensive });
  }

  budgetStatus(scope: BudgetScopeRef): BudgetAggregate {
    return this.budget.aggregate(scope);
  }
}
