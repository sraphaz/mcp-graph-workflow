/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-policy-engine-context-routing — Task 1.2: Implementação determinística
 */

import { describe, it, expect } from "vitest";
import { decideRoute } from "../core/llm/policy-engine.js";
import type { PolicySignals, PolicyConfig } from "../core/llm/policy-engine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignals(overrides: Partial<PolicySignals> = {}): PolicySignals {
  return {
    promptTokensEstimate: 500,
    budgetRemainingPct: 0.80,
    latencyP95ByProvider: new Map([
      ["local-hub", 120],
      ["openai", 300],
      ["anthropic", 450],
    ]),
    backendHealth: new Map([
      ["local-hub", "online"],
      ["openai", "online"],
      ["anthropic", "online"],
    ]),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    mode: "enforce",
    preferLocalWhenBudgetBelow: 0.10,
    failoverChain: ["openai", "anthropic"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC2: forceProvider → chain de 1, appliedRule "forced"
// ---------------------------------------------------------------------------

describe("decideRoute — AC2: forceProvider", () => {
  it("returns single-element chain with appliedRule forced", () => {
    const result = decideRoute(
      makeSignals(),
      makeConfig({ forceProvider: "anthropic" }),
    );
    expect(result.chain).toEqual(["anthropic"]);
    expect(result.appliedRule).toBe("forced");
    expect(result.reasonsByProvider["anthropic"]).toContain("forced");
  });

  it("forceProvider overrides budget rule (evaluated first)", () => {
    const signals = makeSignals({ budgetRemainingPct: 0.02 });
    const config = makeConfig({ forceProvider: "openai" });
    const result = decideRoute(signals, config);
    expect(result.chain).toEqual(["openai"]);
    expect(result.appliedRule).toBe("forced");
  });
});

// ---------------------------------------------------------------------------
// AC1: budget ≤ preferLocalWhenBudgetBelow + local-hub online → low_budget
// ---------------------------------------------------------------------------

describe("decideRoute — AC1: low_budget", () => {
  it("places local-hub first when budget at 5% and local-hub online", () => {
    const signals = makeSignals({
      budgetRemainingPct: 0.05,
      backendHealth: new Map([
        ["local-hub", "online"],
        ["openai", "online"],
        ["anthropic", "online"],
      ]),
    });
    const config = makeConfig({ preferLocalWhenBudgetBelow: 0.10 });
    const result = decideRoute(signals, config);
    expect(result.chain[0]).toBe("local-hub");
    expect(result.appliedRule).toBe("low_budget");
    expect(result.reasonsByProvider["local-hub"]).toContain("low_budget");
  });

  it("skips low_budget rule when local-hub is offline", () => {
    const signals = makeSignals({
      budgetRemainingPct: 0.02,
      backendHealth: new Map([
        ["local-hub", "offline"],
        ["openai", "online"],
        ["anthropic", "online"],
      ]),
    });
    const result = decideRoute(signals, makeConfig());
    expect(result.chain[0]).not.toBe("local-hub");
  });

  it("skips low_budget rule when budget is above threshold", () => {
    const signals = makeSignals({ budgetRemainingPct: 0.50 });
    const result = decideRoute(signals, makeConfig());
    expect(result.appliedRule).not.toBe("low_budget");
  });
});

// ---------------------------------------------------------------------------
// AC3: maxAcceptableLatencyMs → latency_filter removes high-latency providers
// ---------------------------------------------------------------------------

describe("decideRoute — AC3: latency_filter", () => {
  it("removes openai when its p95 exceeds maxAcceptableLatencyMs", () => {
    const signals = makeSignals({
      latencyP95ByProvider: new Map([
        ["openai", 600],
        ["anthropic", 200],
      ]),
    });
    const config = makeConfig({ maxAcceptableLatencyMs: 400 });
    const result = decideRoute(signals, config);
    expect(result.chain).not.toContain("openai");
    expect(result.appliedRule).toBe("latency_filter");
  });

  it("keeps providers with p95 at exactly the threshold", () => {
    const signals = makeSignals({
      latencyP95ByProvider: new Map([
        ["openai", 400],
        ["anthropic", 200],
      ]),
    });
    const config = makeConfig({ maxAcceptableLatencyMs: 400 });
    const result = decideRoute(signals, config);
    expect(result.chain).toContain("openai");
  });

  it("skips latency_filter when maxAcceptableLatencyMs is not set", () => {
    const config = makeConfig({ maxAcceptableLatencyMs: undefined });
    const result = decideRoute(makeSignals(), config);
    expect(result.appliedRule).toBe("default_chain");
  });

  it("returns latency_filter appliedRule when at least one provider filtered", () => {
    const signals = makeSignals({
      latencyP95ByProvider: new Map([["openai", 9999], ["anthropic", 100]]),
    });
    const config = makeConfig({ maxAcceptableLatencyMs: 500 });
    const result = decideRoute(signals, config);
    expect(result.appliedRule).toBe("latency_filter");
    expect(result.reasonsByProvider["anthropic"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC4: default → chain = config.failoverChain, appliedRule "default_chain"
// ---------------------------------------------------------------------------

describe("decideRoute — AC4: default_chain", () => {
  it("returns failoverChain when no rule fires", () => {
    const config = makeConfig({
      failoverChain: ["openai", "anthropic"],
    });
    const result = decideRoute(makeSignals(), config);
    expect(result.chain).toEqual(["openai", "anthropic"]);
    expect(result.appliedRule).toBe("default_chain");
  });

  it("reasonsByProvider covers all providers in default chain", () => {
    const config = makeConfig({ failoverChain: ["openai", "anthropic"] });
    const result = decideRoute(makeSignals(), config);
    for (const p of result.chain) {
      expect(result.reasonsByProvider[p]).toBeDefined();
      expect(result.reasonsByProvider[p].length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// AC5: pure function — same input → same output, no side-effects
// ---------------------------------------------------------------------------

describe("decideRoute — AC5: purity", () => {
  it("returns identical output for identical inputs (deterministic)", () => {
    const signals = makeSignals({ budgetRemainingPct: 0.05 });
    const config = makeConfig();
    const r1 = decideRoute(signals, config);
    const r2 = decideRoute(signals, config);
    expect(r1).toEqual(r2);
  });

  it("does not mutate the input signals", () => {
    const signals = makeSignals();
    const originalSize = signals.latencyP95ByProvider.size;
    decideRoute(signals, makeConfig());
    expect(signals.latencyP95ByProvider.size).toBe(originalSize);
  });

  it("does not mutate the failoverChain array in config", () => {
    const config = makeConfig({ failoverChain: ["openai", "anthropic"] });
    const original = [...config.failoverChain];
    decideRoute(makeSignals(), config);
    expect(config.failoverChain).toEqual(original);
  });

  it("rule evaluation order: forced > low_budget > latency_filter > default", () => {
    const signals = makeSignals({
      budgetRemainingPct: 0.01,
      latencyP95ByProvider: new Map([["openai", 9999], ["anthropic", 9999]]),
    });
    const config = makeConfig({
      forceProvider: "copilot",
      maxAcceptableLatencyMs: 100,
    });
    const result = decideRoute(signals, config);
    expect(result.appliedRule).toBe("forced");
  });
});
