/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T05 — compaction circuit breaker tests.
 */

import { describe, it, expect } from "vitest";
import {
  CompactionCircuitBreaker,
  MAX_CONSECUTIVE_FAILURES,
  RESET_TIMEOUT_MS,
} from "../core/context/compaction-circuit-breaker.js";

describe("compaction-circuit-breaker (E7.T05)", () => {
  it("constants: maxFailures=3, resetTimeoutMs=5min", () => {
    expect(MAX_CONSECUTIVE_FAILURES).toBe(3);
    expect(RESET_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it("starts closed and allows calls", () => {
    const cb = new CompactionCircuitBreaker();
    expect(cb.getState()).toBe("closed");
    expect(cb.canCall()).toBe(true);
  });

  it("opens after MAX_CONSECUTIVE_FAILURES", () => {
    const cb = new CompactionCircuitBreaker();
    cb.recordFailure();
    expect(cb.getState()).toBe("closed");
    cb.recordFailure();
    expect(cb.getState()).toBe("closed");
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
    expect(cb.canCall()).toBe(false);
  });

  it("recordSuccess resets failures and re-closes", () => {
    const cb = new CompactionCircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.getState()).toBe("closed");
  });

  it("transitions open → half-open after resetTimeoutMs", () => {
    let now = 0;
    const cb = new CompactionCircuitBreaker({ now: () => now });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
    expect(cb.canCall()).toBe(false);

    now = RESET_TIMEOUT_MS + 1;
    expect(cb.canCall()).toBe(true);
    expect(cb.getState()).toBe("half-open");
  });

  it("half-open success returns to closed", () => {
    let now = 0;
    const cb = new CompactionCircuitBreaker({ now: () => now });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    now = RESET_TIMEOUT_MS + 1;
    cb.canCall(); // transitions to half-open
    cb.recordSuccess();
    expect(cb.getState()).toBe("closed");
    expect(cb.getFailureCount()).toBe(0);
  });

  it("half-open failure re-opens immediately", () => {
    let now = 0;
    const cb = new CompactionCircuitBreaker({ now: () => now });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    now = RESET_TIMEOUT_MS + 1;
    cb.canCall();
    expect(cb.getState()).toBe("half-open");
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
  });

  it("reset() clears state regardless of current status", () => {
    const cb = new CompactionCircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.reset();
    expect(cb.getState()).toBe("closed");
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.canCall()).toBe(true);
  });

  it("custom thresholds honored", () => {
    const cb = new CompactionCircuitBreaker({ maxFailures: 1 });
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
  });
});
