/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE — Self-map: classify post-merge regressions into actionable
 * buckets so the auto-issue body carries an accurate label set and the
 * lessons-store gets a typed pattern key.
 *
 * Pure decision module. Input = CI output / test output / diff summary.
 * Output = bucket + label + suggested issue title.
 *
 * Buckets are coarse on purpose — narrow categories drift fast. The
 * actual offending file/test goes into the issue body, not the bucket.
 */

export type RegressionBucket =
  | "test-flake"
  | "type-regression"
  | "harness-drop"
  | "api-break"
  | "perf-regression"
  | "build-failure"
  | "unknown";

export interface RegressionSignals {
  /** stdout/stderr from the failing CI step or local test run */
  readonly ciOutput?: string;
  /** delta in harness score (positive = improvement, negative = regression) */
  readonly harnessDelta?: number;
  /** delta in p95 latency / cycle time (positive = slower) */
  readonly perfDelta?: number;
  /** files changed in the suspect commit */
  readonly changedFiles?: ReadonlyArray<string>;
}

export interface RegressionClassification {
  readonly bucket: RegressionBucket;
  readonly labels: ReadonlyArray<string>;
  readonly suggestedTitle: string;
  readonly rationale: string;
}

const TEST_FLAKE_RE = /\b(retry|retries|timeout exceeded|flake|flaky|intermittent)\b/i;
const TYPE_ERROR_RE = /\b(TS\d{4}|Type\s+'[^']+'\s+is not assignable|cannot find name|tsc.*error)\b/i;
const BUILD_RE = /\b(npm\s+ERR!|esbuild error|Cannot find module|Rollup failed)\b/i;
const API_BREAK_RE = /\b(does not exist on type|argument of type .* is not assignable|missing the following properties)\b/i;

/**
 * Classify a regression. The order of checks is deliberate:
 *   1. harness drop is unambiguous (numeric)
 *   2. perf regression next (numeric)
 *   3. then text patterns ordered by specificity
 *   4. fallback to "unknown" so the orchestrator opens a generic issue
 *      rather than guessing.
 */
export function classifyRegression(signals: RegressionSignals): RegressionClassification {
  if (typeof signals.harnessDelta === "number" && signals.harnessDelta <= -5) {
    return {
      bucket: "harness-drop",
      labels: ["regression", "harness", "auto"],
      suggestedTitle: `Harness score dropped ${Math.abs(signals.harnessDelta)} points`,
      rationale: `harnessDelta=${signals.harnessDelta} is below the -5 alert threshold`,
    };
  }

  if (typeof signals.perfDelta === "number" && signals.perfDelta >= 0.2) {
    return {
      bucket: "perf-regression",
      labels: ["regression", "performance", "auto"],
      suggestedTitle: `Latency regression ≥ ${Math.round(signals.perfDelta * 100)}%`,
      rationale: `perfDelta=${signals.perfDelta} crosses 20% threshold`,
    };
  }

  const text = signals.ciOutput ?? "";

  if (TEST_FLAKE_RE.test(text)) {
    return {
      bucket: "test-flake",
      labels: ["regression", "flake", "auto"],
      suggestedTitle: "Test flake detected post-merge",
      rationale: "matched flake-pattern in CI output",
    };
  }

  if (BUILD_RE.test(text)) {
    return {
      bucket: "build-failure",
      labels: ["regression", "build", "auto"],
      suggestedTitle: "Build failure post-merge",
      rationale: "matched build-failure pattern in CI output",
    };
  }

  if (API_BREAK_RE.test(text)) {
    return {
      bucket: "api-break",
      labels: ["regression", "api-break", "auto"],
      suggestedTitle: "API break detected post-merge",
      rationale: "matched api-break pattern in CI output",
    };
  }

  if (TYPE_ERROR_RE.test(text)) {
    return {
      bucket: "type-regression",
      labels: ["regression", "typecheck", "auto"],
      suggestedTitle: "Type-check regression post-merge",
      rationale: "matched type-error pattern in CI output",
    };
  }

  return {
    bucket: "unknown",
    labels: ["regression", "auto", "needs-triage"],
    suggestedTitle: "Post-merge regression — needs triage",
    rationale: "no signal pattern matched — caller should attach raw CI output",
  };
}

/**
 * Build a Markdown issue body from signals + classification + bisect output.
 * Kept as a string-builder so the orchestrator stays free of formatting code.
 */
export function buildIssueBody(input: {
  readonly classification: RegressionClassification;
  readonly suspectSha: string | null;
  readonly bisectTrail?: ReadonlyArray<string>;
  readonly ciOutputExcerpt?: string;
}): string {
  const lines: string[] = [];
  lines.push("## Auto-detected regression");
  lines.push("");
  lines.push(`- **Bucket:** \`${input.classification.bucket}\``);
  lines.push(`- **Rationale:** ${input.classification.rationale}`);
  if (input.suspectSha) lines.push(`- **Suspect commit:** \`${input.suspectSha}\``);
  if (input.bisectTrail && input.bisectTrail.length > 0) {
    lines.push("");
    lines.push("## Bisect trail");
    for (const sha of input.bisectTrail) lines.push(`- \`${sha}\``);
  }
  if (input.ciOutputExcerpt) {
    lines.push("");
    lines.push("## CI excerpt");
    lines.push("```");
    lines.push(input.ciOutputExcerpt.slice(0, 2000));
    lines.push("```");
  }
  lines.push("");
  lines.push("_Opened automatically by mcp-graph auto-merge orchestrator._");
  return lines.join("\n");
}
