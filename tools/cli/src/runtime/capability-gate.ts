export type CapabilityTier = "T1" | "T2" | "T3" | "T4";
export type FeatureName = "assembleSiblingContext";

export interface GateDecision {
  tier: CapabilityTier;
  enabled: boolean;
  reason: string;
  warning?: string;
}

interface TierEntry {
  tier: Exclude<CapabilityTier, "T4">;
  patterns: readonly RegExp[];
}

// Anchored regex per family. Order does not matter — first match wins via tier ascending.
const TIER_TABLE: readonly TierEntry[] = [
  {
    tier: "T1",
    patterns: [
      /^claude-opus-4-(7|6)$/,
      /^claude-sonnet-4-6$/,
      /^gpt-5(\b|-)/,
      /^deepseek-r1(\b|-)/,
      /^qwen3-235b-a22b-thinking$/,
    ],
  },
  {
    tier: "T2",
    patterns: [
      /^claude-sonnet-4-5$/,
      /^gpt-4o$/,
      /^gpt-4-turbo$/,
      /^mistral-large(\b|-)/,
      /^llama-3\.3-70b$/,
    ],
  },
  {
    tier: "T3",
    patterns: [
      /^claude-haiku-(4-5|3-5)$/,
      /^gpt-4o-mini$/,
      /^gpt-3\.5-turbo$/,
      /^mistral-7b$/,
      /^llama-3-8b$/,
    ],
  },
];

function classifyTier(modelId: string): CapabilityTier {
  for (const entry of TIER_TABLE) {
    if (entry.patterns.some((re) => re.test(modelId))) {
      return entry.tier;
    }
  }
  return "T4";
}

const STRICT_ENV = "MCP_GRAPH_GATE_STRICT";
const FORCE_ENV = "MCP_GRAPH_FORCE_FEATURE";

/**
 * Decide whether a capability-gated feature should activate for a given model.
 * Defaults per ADR-0054 v2 (post-H12 INDICATIVE_implementation_bound 2026-04-25):
 * advisory by default for T3 (warning emitted, feature stays ON), strict-block
 * available behind MCP_GRAPH_GATE_STRICT=1 as escape hatch while implementation
 * fix is in flight.
 *
 * - MCP_GRAPH_FORCE_FEATURE=1 → forces enable on every tier (overrides strict).
 * - MCP_GRAPH_GATE_STRICT=1   → reverts to v1 behavior (T3 default-OFF).
 */
export function decideFeatureGate(
  modelId: string,
  feature: FeatureName,
  env: NodeJS.ProcessEnv = process.env,
): GateDecision {
  const tier = classifyTier(modelId);
  const forced = env[FORCE_ENV] === "1";
  const strict = env[STRICT_ENV] === "1";

  if (forced) {
    return {
      tier,
      enabled: true,
      reason: "forced_by_env",
      warning: `${FORCE_ENV}=1 bypasses gate. See ADR-0054 + BENCHMARK-v11 — debug only, not for production.`,
    };
  }

  if (feature !== "assembleSiblingContext") {
    return { tier, enabled: false, reason: "unknown_feature" };
  }

  switch (tier) {
    case "T1":
      return { tier, enabled: true, reason: "tier_T1_high_reasoning" };
    case "T2":
      return {
        tier,
        enabled: true,
        reason: "tier_T2_capable_mid_pending_telemetry",
      };
    case "T3":
      if (strict) {
        return {
          tier,
          enabled: false,
          reason: "tier_T3_strict_block",
          warning: `Feature ${feature} blocked for model_id=${modelId} (T3) under ${STRICT_ENV}=1. BENCHMARK-v11 shows −40pt regression on real impl; H12 (eva-agent) shows −30pt vs prompt-injection ceiling — implementation fix is in flight per ADR-0054.`,
        };
      }
      return {
        tier,
        enabled: true,
        reason: "tier_T3_advisory_default_post_h12",
        warning: `Feature ${feature} active for model_id=${modelId} (T3) — known degraded path. BENCHMARK-v11: 20% pass on Haiku decomp+poll. H12 (sim): 50% — gap is implementation-bound (ADR-0054). For production paths, prefer Sonnet+ until fix lands. Set ${STRICT_ENV}=1 to opt out.`,
      };
    case "T4":
      return {
        tier,
        enabled: false,
        reason: "tier_T4_unknown_capability_lookup_miss",
        warning: `capability_lookup_miss: model_id=${modelId} not in tier table. Defaulting feature ${feature} OFF. Add to tools/cli/src/runtime/capability-gate.ts after a benchmark run.`,
      };
  }
}

/** Convenience for a single feature, ignoring decision detail. */
export function isFeatureEnabled(modelId: string, feature: FeatureName): boolean {
  return decideFeatureGate(modelId, feature).enabled;
}

/** Pure introspection (no side-effects): for telemetry / dashboards. */
export function getTier(modelId: string): CapabilityTier {
  return classifyTier(modelId);
}
