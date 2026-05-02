/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies.
 * Feature flag + single-agent fallback selector. Default off so the
 * single-agent path is unaffected for one full release after EPIC 19 lands.
 */

export const MULTIAGENT_ENV_VAR = "MCP_GRAPH_MULTIAGENT";

const TRUTHY = new Set(["on", "true", "1", "yes"]);

export type ExecutionMode = "single" | "multi";

export interface ExecutionModeResult {
  mode: ExecutionMode;
  /** Why this mode was chosen — "override" | "env" | "default". */
  reason: "override" | "env" | "default";
}

export interface SelectExecutionModeOptions {
  /** Caller-side override that wins over env (e.g. CLI flag). */
  override?: ExecutionMode;
}

/** isMultiAgentEnabled — auto-generated description placeholder. */
export function isMultiAgentEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  const raw = env[MULTIAGENT_ENV_VAR];
  if (raw === undefined) return false;
  return TRUTHY.has(raw.toLowerCase());
}

/** selectExecutionMode — auto-generated description placeholder. */
export function selectExecutionMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  opts: SelectExecutionModeOptions = {},
): ExecutionModeResult {
  if (opts.override) {
    return { mode: opts.override, reason: "override" };
  }
  if (env[MULTIAGENT_ENV_VAR] !== undefined) {
    return {
      mode: isMultiAgentEnabled(env) ? "multi" : "single",
      reason: "env",
    };
  }
  return { mode: "single", reason: "default" };
}
