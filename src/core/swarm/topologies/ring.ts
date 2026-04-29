/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Ring topology: agents arranged in a pipeline where output of each agent
 * becomes input of the next, wrapping back to the first (A→B→C→A).
 */

import { McpGraphError } from "../../utils/errors.js";

export type ConflictStrategy = "last_wins" | "first_wins" | "error";

export interface RingRoute {
  from: string;
  to: string;
}

/** Returns ordered ring routes: each agent maps to the next, last wraps to first. */
export function getRingOrder(agentIds: string[]): RingRoute[] {
  if (agentIds.length === 0) return [];
  return agentIds.map((id, i) => ({
    from: id,
    to: agentIds[(i + 1) % agentIds.length],
  }));
}

/** Returns a lookup map: agentId → nextAgentId in the ring. */
export function buildRingRoutes(agentIds: string[]): Record<string, string> {
  const routes: Record<string, string> = {};
  const ring = getRingOrder(agentIds);
  for (const r of ring) {
    routes[r.from] = r.to;
  }
  return routes;
}

/** Convenience re-export: star routing (workers → hub) usable from ring module. */
export function buildStarRoutes(hub: string, workers: string[]): Record<string, string> {
  const routes: Record<string, string> = {};
  for (const w of workers) {
    routes[w] = hub;
  }
  return routes;
}

export interface RingStage<T> {
  agentId: string;
  run: (input: T) => Promise<T> | T;
}

export interface RingPipelineResult<T> {
  ok: boolean;
  output?: T;
  failedAt?: string;
  failedAtIndex?: number;
  error?: unknown;
  /** Stages that completed successfully (in order). */
  completed: string[];
}

/**
 * Run a ring pipeline sequentially: stage[i] receives the output of
 * stage[i-1]. On failure, the pipeline halts and returns which stage
 * raised — failure is isolated to that stage; subsequent stages are
 * not invoked.
 */
export async function runRingPipeline<T>(
  stages: ReadonlyArray<RingStage<T>>,
  initial: T,
): Promise<RingPipelineResult<T>> {
  const completed: string[] = [];
  let current: T = initial;
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stage === undefined) continue;
    try {
      current = await stage.run(current);
      completed.push(stage.agentId);
    } catch (err) {
      return { ok: false, failedAt: stage.agentId, failedAtIndex: i, error: err, completed };
    }
  }
  return { ok: true, output: current, completed };
}

/**
 * Resolves a conflict between two output values for the same key.
 * Used when parallel swarm agents write to the same output key.
 */
export function resolveConflict(
  strategy: ConflictStrategy,
  existingValue: unknown,
  newValue: unknown,
): unknown {
  switch (strategy) {
    case "last_wins":
      return newValue;
    case "first_wins":
      return existingValue;
    case "error":
      throw new McpGraphError(
        `Output key conflict: existing="${existingValue}", new="${newValue}". Strategy=error rejects this.`,
      );
  }
}
