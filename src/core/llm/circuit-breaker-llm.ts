/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-16 LLM Circuit Breaker — per-provider state machine. Three retriable
 * failures in a row open the circuit for `openMs` (default 60s). Once that
 * window elapses, the next call is admitted in half-open state; a success
 * closes the circuit, a failure re-opens it for another window.
 *
 * Pure logic — caller injects a `now()` clock for deterministic testing.
 */

export type CircuitState = "closed" | "half-open" | "open";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  openMs?: number;
  now?: () => number;
}

interface ProviderState {
  consecutiveFailures: number;
  openedAt: number | null;
}

const RETRIABLE_STATUSES = new Set([401, 402, 429]);

export function isCircuitOpenStatus(status: number): boolean {
  if (RETRIABLE_STATUSES.has(status)) return true;
  return status >= 500 && status < 600;
}

export class LlmCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly now: () => number;
  private readonly providers = new Map<string, ProviderState>();

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.openMs = options.openMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  state(provider: string): CircuitState {
    const s = this.providers.get(provider);
    if (!s || s.openedAt === null) return "closed";
    const elapsed = this.now() - s.openedAt;
    return elapsed >= this.openMs ? "half-open" : "open";
  }

  canCall(provider: string): boolean {
    return this.state(provider) !== "open";
  }

  recordFailure(provider: string, status: number): void {
    if (!isCircuitOpenStatus(status)) return;
    const s = this.getOrCreate(provider);

    if (s.openedAt !== null && this.now() - s.openedAt >= this.openMs) {
      // Half-open failure → re-open with fresh window.
      s.openedAt = this.now();
      s.consecutiveFailures = this.failureThreshold;
      return;
    }

    s.consecutiveFailures++;
    if (s.consecutiveFailures >= this.failureThreshold && s.openedAt === null) {
      s.openedAt = this.now();
    }
  }

  recordSuccess(provider: string): void {
    const s = this.getOrCreate(provider);
    s.consecutiveFailures = 0;
    s.openedAt = null;
  }

  private getOrCreate(provider: string): ProviderState {
    let s = this.providers.get(provider);
    if (!s) {
      s = { consecutiveFailures: 0, openedAt: null };
      this.providers.set(provider, s);
    }
    return s;
  }
}
