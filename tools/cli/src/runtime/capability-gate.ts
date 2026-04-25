export type CapabilityTier = "T1" | "T2" | "T3" | "T4";
export type FeatureName = "assembleSiblingContext";

/**
 * Test-task-type signal — used to refine the capability gate beyond model class.
 *
 * Per H12 cycle (eva-agent, 2026-04-25), the BENCHMARK-v11 Haiku regression is
 * carried by **test specifications requiring numerical convergence proofs**
 * (T4/T5 Newton-Raphson). Replacing those tests with simpler ones recovered
 * Haiku to 100% (+80pt swing). Capability gate at the model-class level
 * (per ADR-0054 v2) was an over-broad shutdown — the real signal is per-task-type.
 *
 * - `numerical-convergence`: tests requiring iterative numerical methods
 *   (Newton-Raphson, gradient descent, Platt scaling, sigmoid fitting,
 *   conjugate gradient, optimizer convergence). T3 + this combo → block.
 * - `unknown`: no signal detected; defaults to model-class behavior.
 *   This is the safe default that preserves ADR-0054 v2 (T3 advisory).
 */
export type TaskType = "numerical-convergence" | "unknown";

export interface GateDecision {
  tier: CapabilityTier;
  taskType: TaskType;
  enabled: boolean;
  reason: string;
  warning?: string;
}

export interface GateOptions {
  /**
   * Task-type signal. Default `"unknown"` preserves model-class-only behavior
   * (ADR-0054 v2). When `"numerical-convergence"`, T3 models are blocked
   * (real capability gap, not orchestration issue) per H12-tests confirmed
   * 2026-04-25 (+80pt swing replacing T4/T5 with simple tests).
   */
  taskType?: TaskType;
  /** Env override for testing. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Heuristic regex to detect tasks whose tests require iterative numerical
 * convergence — the carrier identified by H12-tests. Conservative: matches
 * obvious method names; may miss disguised cases. False positives go to
 * higher-tier model (safe).
 */
const NUMERICAL_CONVERGENCE_REGEX =
  /\b(Newton[- ]?Raphson|gradient[ -]descent|sigmoid|optimi[sz]er|conjugate[ -]gradient|convergence[ -]proof|fit\w*Parameters|plattCalibrate|plattSigmoid|nonlinear[ -]solver|root[ -]finding|secant[ -]method)\b/i;

/**
 * Classify a task by signal strings (description, AC, test code).
 * Returns `"numerical-convergence"` only when the regex matches; everything
 * else is `"unknown"` (safe default — defers to model-class behavior).
 */
export function classifyTaskType(signals: {
  description?: string;
  acceptanceCriteria?: readonly string[];
  testCode?: string;
}): TaskType {
  const haystack = [
    signals.description ?? "",
    ...(signals.acceptanceCriteria ?? []),
    signals.testCode ?? "",
  ].join("\n");

  if (NUMERICAL_CONVERGENCE_REGEX.test(haystack)) {
    return "numerical-convergence";
  }
  return "unknown";
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
 *
 * Defaults per ADR-0054 v2 (post-H12 INDICATIVE_implementation_bound 2026-04-25):
 * advisory by default for T3 (warning emitted, feature stays ON), strict-block
 * available behind `MCP_GRAPH_GATE_STRICT=1`.
 *
 * Per H12 cycle CONFIRMED (2026-04-25, 7 experiments): T3 + numerical-convergence
 * task type → blocked at decision time (real capability gap on T4/T5 Newton-
 * Raphson tests). Model-class tier alone is too coarse; the carrier is task-type.
 *
 * - `MCP_GRAPH_FORCE_FEATURE=1` → forces enable on every tier (overrides strict
 *   AND task-type gate). Debug only.
 * - `MCP_GRAPH_GATE_STRICT=1`   → reverts to v1 behavior (T3 default-OFF).
 * - `options.taskType="numerical-convergence"` → T3 blocked even without strict.
 */
export function decideFeatureGate(
  modelId: string,
  feature: FeatureName,
  options: GateOptions = {},
): GateDecision {
  const tier = classifyTier(modelId);
  const taskType: TaskType = options.taskType ?? "unknown";
  const env = options.env ?? process.env;
  const forced = env[FORCE_ENV] === "1";
  const strict = env[STRICT_ENV] === "1";

  if (forced) {
    return {
      tier,
      taskType,
      enabled: true,
      reason: "forced_by_env",
      warning: `${FORCE_ENV}=1 bypasses gate. See ADR-0054 + BENCHMARK-v11 — debug only, not for production.`,
    };
  }

  if (feature !== "assembleSiblingContext") {
    return { tier, taskType, enabled: false, reason: "unknown_feature" };
  }

  switch (tier) {
    case "T1":
      return { tier, taskType, enabled: true, reason: "tier_T1_high_reasoning" };
    case "T2":
      return {
        tier,
        taskType,
        enabled: true,
        reason: "tier_T2_capable_mid_pending_telemetry",
      };
    case "T3":
      // Per-task-type block: T3 + numerical-convergence is a real capability gap
      // (H12-tests confirmed +80pt swing). Block regardless of strict flag.
      if (taskType === "numerical-convergence") {
        return {
          tier,
          taskType,
          enabled: false,
          reason: "tier_T3_blocked_for_numerical_convergence",
          warning: `Feature ${feature} blocked for model_id=${modelId} (T3) + task_type=numerical-convergence. H12-tests (eva-agent, 2026-04-25, 7 experiments) confirmed real capability gap on Newton-Raphson convergence; replacing T4/T5 with simple tests recovered Haiku to 100%. Route this task to T2/T1 model. See ADR-0054 + memory project_h12_ablation_raw_output_refuted.md.`,
        };
      }
      if (strict) {
        return {
          tier,
          taskType,
          enabled: false,
          reason: "tier_T3_strict_block",
          warning: `Feature ${feature} blocked for model_id=${modelId} (T3) under ${STRICT_ENV}=1. BENCHMARK-v11 shows −40pt regression on real impl; H12 (eva-agent) shows −30pt vs prompt-injection ceiling — implementation fix is in flight per ADR-0054.`,
        };
      }
      return {
        tier,
        taskType,
        enabled: true,
        reason: "tier_T3_advisory_default_post_h12",
        warning: `Feature ${feature} active for model_id=${modelId} (T3) — known degraded path. BENCHMARK-v11: 20% pass on Haiku decomp+poll. H12 (sim): 50% — gap is implementation-bound (ADR-0054). For production paths, prefer Sonnet+ until fix lands. Set ${STRICT_ENV}=1 to opt out.`,
      };
    case "T4":
      return {
        tier,
        taskType,
        enabled: false,
        reason: "tier_T4_unknown_capability_lookup_miss",
        warning: `capability_lookup_miss: model_id=${modelId} not in tier table. Defaulting feature ${feature} OFF. Add to tools/cli/src/runtime/capability-gate.ts after a benchmark run.`,
      };
  }
}

/** Convenience for a single feature, ignoring decision detail. */
export function isFeatureEnabled(modelId: string, feature: FeatureName, options?: GateOptions): boolean {
  return decideFeatureGate(modelId, feature, options).enabled;
}

/** Pure introspection (no side-effects): for telemetry / dashboards. */
export function getTier(modelId: string): CapabilityTier {
  return classifyTier(modelId);
}
