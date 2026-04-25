/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * BridgeClient — minimal HTTP client for the Copilot Bridge VS Code
 * extension. Two responsibilities:
 *
 *   1. health() — GET /health, returns {ok, models[]}.
 *   2. ensureReady() — exponential backoff (250ms → 4s, 30s budget) until
 *      a 200 lands or the budget is exhausted. Throws `bridge_unreachable`
 *      on exhaustion.
 *
 * Defensive: fetch and sleep are injected so unit tests don't hit the
 * network or wall clock. ADR 0042 §plan-payload — graph rastreia, bridge
 * é serviço externo.
 */

import { logger } from "../utils/logger.js";

export interface BridgeHealth {
  ok: boolean;
  models: string[];
}

export interface BackoffOptions {
  initialMs: number;
  maxMs: number;
  budgetMs: number;
}

export interface BridgeClientOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  backoff?: BackoffOptions;
}

const DEFAULT_BACKOFF: BackoffOptions = {
  initialMs: 250,
  maxMs: 4000,
  budgetMs: 30_000,
};

/**
 * Build the array of delays an `ensureReady` loop will sleep between
 * attempts. Pure: no side effects, no time. Tested in isolation.
 *
 * Schedule: initialMs * 2^k, capped at maxMs, summed until adding the next
 * delay would exceed budgetMs. Always returns at least one delay so the
 * caller makes a single attempt even with a tiny budget.
 */
export function computeBackoffSchedule(opts: BackoffOptions): number[] {
  const out: number[] = [];
  let next = opts.initialMs;
  let total = 0;
  // First delay always included so we attempt at least once.
  out.push(next);
  total += next;
  while (true) {
    next = Math.min(next * 2, opts.maxMs);
    if (total + next > opts.budgetMs) break;
    out.push(next);
    total += next;
  }
  return out;
}

/** Joins a base URL with a path, tolerant of trailing slash on either side. */
function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export class BridgeClient {
  private readonly bridgeUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly backoff: BackoffOptions;

  constructor(bridgeUrl: string, options: BridgeClientOptions = {}) {
    this.bridgeUrl = bridgeUrl;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.sleep =
      options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.backoff = options.backoff ?? DEFAULT_BACKOFF;
  }

  /** GET /health — returns parsed body or throws structured error. */
  async health(): Promise<BridgeHealth> {
    const url = joinUrl(this.bridgeUrl, "/health");
    const res = await this.fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`bridge health ${res.status} at ${url}`);
    }
    const body = (await res.json()) as Partial<BridgeHealth>;
    return {
      ok: body.ok === true,
      models: Array.isArray(body.models) ? body.models : [],
    };
  }

  /**
   * Retry health() with exponential backoff until success or the schedule
   * is exhausted. On exhaustion throws an error keyed by `bridge_unreachable`
   * so the calling tool can map it to the BrowserPilotErrorSchema code.
   */
  async ensureReady(): Promise<BridgeHealth> {
    const schedule = computeBackoffSchedule(this.backoff);
    let lastErr: unknown;
    for (let i = 0; i < schedule.length; i++) {
      try {
        return await this.health();
      } catch (err) {
        lastErr = err;
        logger.debug("bridge-client: health attempt failed", {
          attempt: i + 1,
          totalAttempts: schedule.length,
          reason: err instanceof Error ? err.message : String(err),
        });
        // Sleep before next attempt — but not after the final attempt.
        if (i < schedule.length - 1) {
          await this.sleep(schedule[i]);
        }
      }
    }
    const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(`bridge_unreachable after ${schedule.length} attempts: ${reason}`);
  }
}
