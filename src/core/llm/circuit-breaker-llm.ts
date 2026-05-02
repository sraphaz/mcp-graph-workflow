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

/** isCircuitOpenStatus — auto-generated description placeholder. */
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
    const sVar = this.providers.get(provider);
    if (!sVar || sVar.openedAt === null) return "closed";
    const elapsed = this.now() - sVar.openedAt;
    return elapsed >= this.openMs ? "half-open" : "open";
  }

  canCall(provider: string): boolean {
    return this.state(provider) !== "open";
  }

  recordFailure(provider: string, status: number): void {
    if (!isCircuitOpenStatus(status)) return;
    const sVar = this.getOrCreate(provider);

    if (sVar.openedAt !== null && this.now() - sVar.openedAt >= this.openMs) {
      // Half-open failure → re-open with fresh window.
      sVar.openedAt = this.now();
      sVar.consecutiveFailures = this.failureThreshold;
      return;
    }

    sVar.consecutiveFailures++;
    if (sVar.consecutiveFailures >= this.failureThreshold && sVar.openedAt === null) {
      sVar.openedAt = this.now();
    }
  }

  recordSuccess(provider: string): void {
    const sVar = this.getOrCreate(provider);
    sVar.consecutiveFailures = 0;
    sVar.openedAt = null;
  }

  private getOrCreate(provider: string): ProviderState {
    let sVar = this.providers.get(provider);
    if (!sVar) {
      sVar = { consecutiveFailures: 0, openedAt: null };
      this.providers.set(provider, sVar);
    }
    return sVar;
  }
}
