/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-policy-engine-context-routing — Task 1.1: Tipos + assinatura
 *
 * Routing policy types for the `decideRoute` pipeline. Deterministic
 * scoring — no LLM call in the decision path (§ADR-deterministic-first).
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
  maxAcceptableLatencyMs?: number;
  forceProvider?: ProviderName;
};

export type RouteDecision = {
  chain: ProviderName[];
  reasonsByProvider: Record<string, string[]>;
  appliedRule: string;
};
