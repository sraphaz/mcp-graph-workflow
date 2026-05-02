/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C3 — Autonomic scaling by xpSize.
 * Pure mapping XS/S/M/L/XL → desired pool size. AutopilotScheduler consulta
 * antes de dispatch e chama swarm-coordinator.scale(N). Scale-down quando
 * sessão idle > IDLE_SCALEDOWN_MS.
 */

import type { XpSize } from "./budget-aware-picker.js";

export const SIZE_TO_AGENTS: Record<XpSize, number> = {
  XS: 1,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
};

export const DEFAULT_POOL_MAX = 8;
export const POOL_MIN_IDLE = 2;
export const IDLE_SCALEDOWN_MS = 5 * 60 * 1000;

export interface ScaleDecisionInput {
  xpSize?: XpSize;
  currentSize: number;
  poolMax?: number;
}

export interface ScaleDownInput {
  currentSize: number;
  idleMs: number;
  poolMin?: number;
  idleThresholdMs?: number;
}

/** getPoolMax — auto-generated description placeholder. */
export function getPoolMax(env: NodeJS.ProcessEnv = process.env): number {
  const vVar = env.MCP_GRAPH_AGENT_POOL_MAX;
  if (!vVar) return DEFAULT_POOL_MAX;
  const nVar = Number(vVar);
  return Number.isFinite(nVar) && nVar > 0 ? Math.floor(nVar) : DEFAULT_POOL_MAX;
}

/** Decide target pool size for an incoming task. Caps at poolMax. */
export function targetSizeForTask(input: ScaleDecisionInput): number {
  const max = input.poolMax ?? DEFAULT_POOL_MAX;
  if (!input.xpSize) return Math.max(1, Math.min(input.currentSize, max));
  const desired = SIZE_TO_AGENTS[input.xpSize];
  return Math.min(Math.max(desired, input.currentSize), max);
}

/** Decide if pool should scale down based on idle time. */
export function shouldScaleDown(input: ScaleDownInput): { down: boolean; targetSize: number } {
  const min = input.poolMin ?? POOL_MIN_IDLE;
  const threshold = input.idleThresholdMs ?? IDLE_SCALEDOWN_MS;
  if (input.idleMs > threshold && input.currentSize > min) {
    return { down: true, targetSize: min };
  }
  return { down: false, targetSize: input.currentSize };
}
