/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-policy-engine-context-routing — Task 1.1: Tipos + assinatura
 *                                        Task 1.2: Implementação determinística
 *
 * Routing policy types + `decideRoute` for the LLM gateway. Fully deterministic
 * — no LLM call in the decision path (§ADR-deterministic-first).
 *
 * Rule evaluation order (hardcoded, no heuristics):
 *   1. forceProvider → single-element chain, reason "forced"
 *   2. budgetRemainingPct < preferLocalWhenBudgetBelow + local-hub online
 *      → local-hub first, reason "low_budget"
 *   3. maxAcceptableLatencyMs defined → filter providers with p95 above, reason "latency_filter"
 *   4. Default → config.failoverChain, reason "default_chain"
 */

import type { ProviderName } from "./types.js";

export type { ProviderName };

export type PolicySignals = {
  promptTokensEstimate: number;
  budgetRemainingPct: number;
  latencyP95ByProvider: Map<ProviderName, number>;
  backendHealth: Map<ProviderName, "online" | "degraded" | "offline">;
};

export type PolicyConfig = {
  mode: "off" | "observe" | "enforce";
  preferLocalWhenBudgetBelow: number;
  failoverChain: ProviderName[];
  maxAcceptableLatencyMs?: number;
  forceProvider?: ProviderName;
};

export type RouteDecision = {
  chain: ProviderName[];
  reasonsByProvider: Record<string, string[]>;
  appliedRule: string;
};

// ---------------------------------------------------------------------------
// decideRoute — pure, deterministic, zero ML
// ---------------------------------------------------------------------------

function buildReasons(
  chain: ProviderName[],
  primary: ProviderName | null,
  primaryReason: string,
  fallbackReason: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const p of chain) {
    out[p] = [p === primary ? primaryReason : fallbackReason];
  }
  return out;
}

export function decideRoute(
  signals: PolicySignals,
  config: PolicyConfig,
): RouteDecision {
  // Rule 1: forceProvider — highest precedence
  if (config.forceProvider !== undefined) {
    return {
      chain: [config.forceProvider],
      reasonsByProvider: { [config.forceProvider]: ["forced"] },
      appliedRule: "forced",
    };
  }

  // Rule 2: low budget + local-hub online → local-hub first
  if (signals.budgetRemainingPct < config.preferLocalWhenBudgetBelow) {
    const localHealth = signals.backendHealth.get("local-hub");
    if (localHealth === "online") {
      const rest = config.failoverChain.filter((p) => p !== "local-hub");
      const chain: ProviderName[] = ["local-hub", ...rest];
      return {
        chain,
        reasonsByProvider: buildReasons(chain, "local-hub", "low_budget", "fallback"),
        appliedRule: "low_budget",
      };
    }
  }

  // Rule 3: latency filter — remove providers with p95 above threshold
  if (config.maxAcceptableLatencyMs !== undefined) {
    const threshold = config.maxAcceptableLatencyMs;
    const filtered = config.failoverChain.filter((p) => {
      const p95 = signals.latencyP95ByProvider.get(p);
      return p95 === undefined || p95 <= threshold;
    });
    if (filtered.length < config.failoverChain.length) {
      const reasonsByProvider: Record<string, string[]> = {};
      for (const p of filtered) {
        reasonsByProvider[p] = ["latency_ok"];
      }
      return {
        chain: filtered,
        reasonsByProvider,
        appliedRule: "latency_filter",
      };
    }
  }

  // Default: static failover chain from config
  const reasonsByProvider: Record<string, string[]> = {};
  for (const p of config.failoverChain) {
    reasonsByProvider[p] = ["default_chain"];
  }
  return {
    chain: [...config.failoverChain],
    reasonsByProvider,
    appliedRule: "default_chain",
  };
}
