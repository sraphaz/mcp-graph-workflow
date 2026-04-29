/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication.
 * Dual-path handoff: try A2A first, auto-fall-back to graph state when
 * A2A is disabled or unavailable. The graph remains the authoritative
 * state — A2A is just a COURIER (no decisions, only context handoff).
 */

import type { A2AHandoffInput, A2AHandoffResult } from "./a2a-handoff.js";

export type A2AHandoffFn = <T = unknown>(
  input: A2AHandoffInput<T>,
) => Promise<A2AHandoffResult>;

export interface GraphHandoffResult {
  recorded: boolean;
}

export type GraphHandoff = <T = unknown>(
  input: A2AHandoffInput<T>,
) => Promise<GraphHandoffResult>;

export interface DualPathHandoffOptions {
  a2a: A2AHandoffFn;
  graph: GraphHandoff;
}

export type HandoffPath = "a2a" | "graph" | "graph-fallback";

export interface DualPathHandoffResult {
  path: HandoffPath;
  messageId: string | null;
  fallbackReason?: string;
}

export function createDualPathHandoff(opts: DualPathHandoffOptions) {
  return async <T = unknown>(input: A2AHandoffInput<T>): Promise<DualPathHandoffResult> => {
    let a2aResult: A2AHandoffResult | null = null;
    let fallbackReason: string | undefined;

    try {
      a2aResult = await opts.a2a(input);
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }

    if (a2aResult?.delivered) {
      return { path: "a2a", messageId: a2aResult.messageId };
    }

    await opts.graph(input);
    return {
      path: fallbackReason ? "graph-fallback" : "graph",
      messageId: null,
      ...(fallbackReason ? { fallbackReason } : {}),
    };
  };
}
