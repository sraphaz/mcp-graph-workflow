/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Tipos + assinatura `policy-engine.ts`
 *
 * AC1: GIVEN tipos exportados WHEN consumidos THEN sem `any`
 * AC2: GIVEN RouteDecision.reasonsByProvider WHEN inspecionado THEN
 *      cada provider na chain tem ≥1 razão
 */

import { describe, it, expect } from "vitest";
import type {
  PolicySignals,
  PolicyConfig,
  RouteDecision,
} from "../core/llm/policy-engine.js";

// ---------------------------------------------------------------------------
// AC1: exported types — verified via TypeScript assignability (no `any`)
// ---------------------------------------------------------------------------

describe("policy-engine types — AC1: no any", () => {
  it("PolicySignals accepts valid values", () => {
    const signals: PolicySignals = {
      promptTokensEstimate: 1200,
      budgetRemainingPct: 0.45,
      latencyP95ByProvider: new Map([["local", 120], ["openai", 340]]),
      backendHealth: new Map([["local", "online"], ["openai", "degraded"]]),
    };
    expect(signals.promptTokensEstimate).toBe(1200);
    expect(signals.budgetRemainingPct).toBe(0.45);
  });

  it("PolicyConfig accepts all modes", () => {
    const modes: PolicyConfig["mode"][] = ["off", "observe", "enforce"];
    for (const mode of modes) {
      const cfg: PolicyConfig = { mode, preferLocalWhenBudgetBelow: 0.1 };
      expect(cfg.mode).toBe(mode);
    }
  });

  it("PolicyConfig optional fields are absent when not provided", () => {
    const cfg: PolicyConfig = { mode: "off", preferLocalWhenBudgetBelow: 0.1 };
    expect(cfg.maxAcceptableLatencyMs).toBeUndefined();
    expect(cfg.forceProvider).toBeUndefined();
  });

  it("RouteDecision contains chain, reasonsByProvider, appliedRule", () => {
    const decision: RouteDecision = {
      chain: ["local", "openai"],
      reasonsByProvider: {
        local: ["low_budget"],
        openai: ["fallback"],
      },
      appliedRule: "low_budget→local_first",
    };
    expect(decision.chain).toHaveLength(2);
    expect(decision.appliedRule).toBe("low_budget→local_first");
  });
});

// ---------------------------------------------------------------------------
// AC2: each provider in chain has ≥1 reason in reasonsByProvider
// ---------------------------------------------------------------------------

describe("policy-engine types — AC2: reasonsByProvider coverage", () => {
  it("all providers in chain are present in reasonsByProvider", () => {
    const decision: RouteDecision = {
      chain: ["local", "openai", "anthropic"],
      reasonsByProvider: {
        local: ["low_budget", "latency_ok"],
        openai: ["fallback"],
        anthropic: ["secondary_fallback"],
      },
      appliedRule: "low_budget→local_first",
    };
    for (const provider of decision.chain) {
      const reasons = decision.reasonsByProvider[provider];
      expect(reasons, `provider "${provider}" must have ≥1 reason`).toBeDefined();
      expect(reasons.length, `provider "${provider}" must have ≥1 reason`).toBeGreaterThanOrEqual(1);
    }
  });

  it("single-provider chain works", () => {
    const decision: RouteDecision = {
      chain: ["local"],
      reasonsByProvider: { local: ["enforce_local"] },
      appliedRule: "force_provider",
    };
    expect(decision.reasonsByProvider["local"]).toHaveLength(1);
  });

  it("empty chain passes trivially", () => {
    const decision: RouteDecision = {
      chain: [],
      reasonsByProvider: {},
      appliedRule: "no_providers_available",
    };
    for (const provider of decision.chain) {
      const reasons = decision.reasonsByProvider[provider];
      expect(reasons?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    expect(decision.chain).toHaveLength(0);
  });
});
