/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T05 — Compaction circuit breaker.
 * Tri-state breaker (closed → open → half-open → closed). Used by the
 * compaction pipeline to skip the LLM level when summarization is failing
 * repeatedly. Resets to half-open after RESET_TIMEOUT_MS.
 */

export const MAX_CONSECUTIVE_FAILURES = 3;
export const RESET_TIMEOUT_MS = 5 * 60 * 1000;

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  maxFailures?: number;
  resetTimeoutMs?: number;
  /** Inject a clock for tests. */
  now?: () => number;
}

export class CompactionCircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt = 0;
  private readonly maxFailures: number;
  private readonly resetTimeoutMs: number;
  private readonly now: () => number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.maxFailures = opts.maxFailures ?? MAX_CONSECUTIVE_FAILURES;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? RESET_TIMEOUT_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  /**
   * Whether a call is allowed. Side-effect: transitions open → half-open
   * after the reset window so the caller's next attempt becomes the probe.
   */
  canCall(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "half-open") return true;
    if (this.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = "half-open";
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    if (this.state === "half-open") {
      this.openCircuit();
      return;
    }
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.openCircuit();
    }
  }

  /** Force-reset (e.g., session restart). */
  reset(): void {
    this.failures = 0;
    this.state = "closed";
    this.openedAt = 0;
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  private openCircuit(): void {
    this.state = "open";
    this.openedAt = this.now();
    this.failures = this.maxFailures;
  }
}
