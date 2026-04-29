/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T04 — Flaky test detector.
 * Pure decision module: dado N outcomes (pass/fail), decide se a suite é
 * flaky (mistura de resultados). shouldSampleFlakyCheck escolhe se este
 * post-complete tick entra na amostragem (default 5%).
 */

export const DEFAULT_SAMPLE_RATE = 0.05;
export const DEFAULT_RERUN_COUNT = 3;

export interface FlakyDecisionInput {
  outcomes: Array<"pass" | "fail">;
}

export interface FlakyDecision {
  flaky: boolean;
  passes: number;
  fails: number;
}

export function isFlakyDetectorDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_FLAKY_DETECTOR === "off";
}

export function getSampleRate(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MCP_GRAPH_FLAKY_SAMPLE_RATE;
  if (!raw) return DEFAULT_SAMPLE_RATE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return DEFAULT_SAMPLE_RATE;
  return n;
}

export function shouldSampleFlakyCheck(
  rng: () => number = Math.random,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isFlakyDetectorDisabled(env)) return false;
  return rng() < getSampleRate(env);
}

export function decideFlaky(input: FlakyDecisionInput): FlakyDecision {
  let passes = 0;
  let fails = 0;
  for (const o of input.outcomes) {
    if (o === "pass") passes++;
    else fails++;
  }
  return { flaky: passes > 0 && fails > 0, passes, fails };
}
