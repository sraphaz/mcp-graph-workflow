/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Star topology (hub-and-spoke): one coordinator (hub) dispatches tasks to
 * all workers; workers report results back to the hub.
 */

import { McpGraphError } from "../../utils/errors.js";

/** Typed error raised when the hub-side handler fails. */
export class StarHubError extends McpGraphError {
  constructor(
    public readonly hubId: string,
    public readonly cause: unknown,
  ) {
    super(`Star hub "${hubId}" failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "StarHubError";
  }
}

/** Returns the hub agent ID (first in the list by convention). */
export function getHubId(agentIds: string[]): string {
  if (agentIds.length === 0) {
    throw new McpGraphError("Star topology requires at least one agent (the hub)");
  }
  return agentIds[0];
}

/**
 * Builds worker→hub routing map.
 * The hub itself is not included (it dispatches outward, not inward).
 */
export function buildStarRoutes(hub: string, workers: string[]): Record<string, string> {
  const routes: Record<string, string> = {};
  for (const w of workers) {
    routes[w] = hub;
  }
  return routes;
}

/** Returns workers (all agents except the hub). */
export function getWorkers(agentIds: string[]): string[] {
  return agentIds.slice(1);
}

export interface SpokeHandler<I, O> {
  agentId: string;
  reply: (input: I) => Promise<O> | O;
}

export interface SpokeResult<O> {
  agentId: string;
  ok: boolean;
  output?: O;
  error?: unknown;
}

export interface StarBroadcastResult<O> {
  hubId: string;
  spokes: SpokeResult<O>[];
}

/**
 * Hub broadcasts the same `input` to every spoke and collects each spoke's
 * reply individually. Spoke failures are isolated (one failed spoke does
 * not abort the others). Hub-side handler exceptions surface as
 * `StarHubError` (typed) — caller decides whether to retry or escalate.
 */
export async function runStarBroadcast<I, O>(
  hubId: string,
  spokes: ReadonlyArray<SpokeHandler<I, O>>,
  input: I,
  hubHandler?: (input: I) => Promise<I> | I,
): Promise<StarBroadcastResult<O>> {
  let payload: I = input;
  if (hubHandler) {
    try {
      payload = await hubHandler(input);
    } catch (err) {
      throw new StarHubError(hubId, err);
    }
  }
  const results = await Promise.all(
    spokes.map(async (s): Promise<SpokeResult<O>> => {
      try {
        const output = await s.reply(payload);
        return { agentId: s.agentId, ok: true, output };
      } catch (err) {
        return { agentId: s.agentId, ok: false, error: err };
      }
    }),
  );
  return { hubId, spokes: results };
}
