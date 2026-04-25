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
 * Deterministic Retry — seed-stable backoff for multi-agent file conflicts.
 *
 * Uses a seeded PRNG (mulberry32) so that identical (seed, maxRetries, baseDelayMs)
 * inputs always produce the exact same delay sequence. This makes retry behaviour
 * reproducible from audit logs without needing wall-clock timestamps.
 */

import { McpGraphError } from "../utils/errors.js";

export interface RetryPolicy {
  /** Per-agent stable seed — should be the agent or task node ID */
  readonly seed: string;
  /** Maximum number of retry attempts before giving up */
  readonly maxRetries: number;
  /** Base delay in ms — first retry waits approximately this long */
  readonly baseDelayMs: number;
  /** Hard ceiling in ms — no single delay will exceed this */
  readonly ceilingMs: number;
}

export interface RetryLedgerEntry {
  readonly attempt: number;
  readonly delayMs: number;
  readonly reason: string;
}

/** Typed error emitted when all retries are exhausted. */
export class RetryExhaustedError extends McpGraphError {
  readonly attempts: number;

  constructor(attempts: number, lastReason: string) {
    super(
      `Retry exhausted after ${attempts} attempt(s): ${lastReason}. ` +
        `Human intervention required — check for persistent file locks or agent deadlocks.`,
    );
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
  }
}

/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns a function that yields values in [0, 1) each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Deterministic string hash → 32-bit unsigned integer. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pre-compute the full delay sequence for a policy.
 * Result[i] is the delay (ms) before retry attempt i+1.
 */
export function computeRetryDelays(policy: RetryPolicy): number[] {
  const rand = mulberry32(hashSeed(policy.seed));
  const delays: number[] = [];
  for (let i = 0; i < policy.maxRetries; i++) {
    // Exponential backoff with jitter: base * 2^i * (0.5 + rand()*0.5)
    const exponential = policy.baseDelayMs * Math.pow(2, i);
    const jittered = Math.round(exponential * (0.5 + rand() * 0.5));
    delays.push(Math.min(jittered, policy.ceilingMs));
  }
  return delays;
}

/**
 * Run an async operation with deterministic retry on failure.
 *
 * @param op - Operation to retry. Must throw on conflict/failure.
 * @param policy - Retry configuration including seed and ceiling.
 * @param ledger - Optional array to append retry entries for audit. Pass [] to collect.
 */
export async function runWithDeterministicRetry<T>(
  op: () => Promise<T>,
  policy: RetryPolicy,
  ledger?: RetryLedgerEntry[],
): Promise<T> {
  const delays = computeRetryDelays(policy);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= policy.maxRetries) break;

      const delayMs = delays[attempt];
      ledger?.push({ attempt: attempt + 1, delayMs, reason: lastError.message });
      await sleep(delayMs);
    }
  }

  throw new RetryExhaustedError(policy.maxRetries, lastError?.message ?? "unknown");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
