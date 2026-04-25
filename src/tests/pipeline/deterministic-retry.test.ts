/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 5.3: Retry determinista com backoff rastreável
 * AC1 — GIVEN conflito resolvido após 3 retries WHEN log consultado THEN delays são reprodutíveis a partir do seed
 * AC2 — GIVEN mesmo conflito em 2 execuções idênticas WHEN comparadas THEN número de retries idêntico
 * AC3 — GIVEN retry excede teto WHEN exaustão THEN failure tipado com instrução de intervenção humana
 */

import { describe, it, expect } from "vitest";
import {
  computeRetryDelays,
  runWithDeterministicRetry,
  RetryExhaustedError,
  type RetryPolicy,
  type RetryLedgerEntry,
} from "../../core/pipeline/deterministic-retry.js";

const BASE_POLICY: RetryPolicy = {
  seed: "agent-42",
  maxRetries: 5,
  baseDelayMs: 10,
  ceilingMs: 500,
};

describe("AC1 — delays are reproducible from seed", () => {
  it("should produce the same delay sequence for the same seed", () => {
    const delays1 = computeRetryDelays({ seed: "stable-seed", maxRetries: 3, baseDelayMs: 10, ceilingMs: 1000 });
    const delays2 = computeRetryDelays({ seed: "stable-seed", maxRetries: 3, baseDelayMs: 10, ceilingMs: 1000 });
    expect(delays1).toEqual(delays2);
  });

  it("should produce different delay sequences for different seeds", () => {
    const delays1 = computeRetryDelays({ seed: "agent-A", maxRetries: 4, baseDelayMs: 10, ceilingMs: 1000 });
    const delays2 = computeRetryDelays({ seed: "agent-B", maxRetries: 4, baseDelayMs: 10, ceilingMs: 1000 });
    expect(delays1).not.toEqual(delays2);
  });

  it("should record each retry attempt with delay in the ledger", async () => {
    const ledger: RetryLedgerEntry[] = [];
    let attempt = 0;
    await runWithDeterministicRetry(
      async () => {
        attempt++;
        if (attempt < 4) throw new Error("conflict");
      },
      { ...BASE_POLICY, seed: "test-seed" },
      ledger,
    );
    expect(ledger.length).toBe(3); // 3 failures before success
    for (const entry of ledger) {
      expect(typeof entry.attempt).toBe("number");
      expect(typeof entry.delayMs).toBe("number");
      expect(entry.delayMs).toBeGreaterThanOrEqual(0);
      expect(entry.reason).toMatch(/conflict/i);
    }
  });

  it("should record delays matching the computed sequence", async () => {
    const seed = "verify-seed";
    const policy: RetryPolicy = { seed, maxRetries: 5, baseDelayMs: 10, ceilingMs: 1000 };
    const expectedDelays = computeRetryDelays(policy);

    const ledger: RetryLedgerEntry[] = [];
    let attempt = 0;
    await runWithDeterministicRetry(
      async () => {
        attempt++;
        if (attempt < 4) throw new Error("lock conflict");
      },
      policy,
      ledger,
    );

    for (let i = 0; i < ledger.length; i++) {
      expect(ledger[i].delayMs).toBe(expectedDelays[i]);
    }
  });
});

describe("AC2 — identical executions produce identical retry count", () => {
  it("should retry the same number of times for identical inputs", async () => {
    const makeOp = () => {
      let calls = 0;
      return async () => {
        calls++;
        if (calls <= 2) throw new Error("locked");
      };
    };

    const ledger1: RetryLedgerEntry[] = [];
    const ledger2: RetryLedgerEntry[] = [];
    const policy: RetryPolicy = { seed: "same-seed", maxRetries: 5, baseDelayMs: 1, ceilingMs: 100 };

    await runWithDeterministicRetry(makeOp(), policy, ledger1);
    await runWithDeterministicRetry(makeOp(), policy, ledger2);

    expect(ledger1.length).toBe(ledger2.length);
    expect(ledger1.map((e) => e.delayMs)).toEqual(ledger2.map((e) => e.delayMs));
  });

  it("should succeed on the first attempt with no ledger entries when no conflict", async () => {
    const ledger: RetryLedgerEntry[] = [];
    await runWithDeterministicRetry(async () => { /* no-op */ }, BASE_POLICY, ledger);
    expect(ledger.length).toBe(0);
  });

  it("should produce identical ledger structure for two runs with same seed and same conflict count", async () => {
    const policy: RetryPolicy = { seed: "det-seed", maxRetries: 5, baseDelayMs: 5, ceilingMs: 200 };

    const run = async () => {
      const ledger: RetryLedgerEntry[] = [];
      let n = 0;
      await runWithDeterministicRetry(async () => {
        n++;
        if (n < 3) throw new Error("file busy");
      }, policy, ledger);
      return ledger;
    };

    const l1 = await run();
    const l2 = await run();
    expect(l1.length).toBe(l2.length);
    for (let i = 0; i < l1.length; i++) {
      expect(l1[i].attempt).toBe(l2[i].attempt);
      expect(l1[i].delayMs).toBe(l2[i].delayMs);
    }
  });
});

describe("AC3 — retry ceiling exceeded throws typed RetryExhaustedError", () => {
  it("should throw RetryExhaustedError when max retries is exceeded", async () => {
    const policy: RetryPolicy = { seed: "ceiling-seed", maxRetries: 3, baseDelayMs: 1, ceilingMs: 100 };
    await expect(
      runWithDeterministicRetry(async () => { throw new Error("always fails"); }, policy),
    ).rejects.toThrow(RetryExhaustedError);
  });

  it("should include human intervention instruction in the error message", async () => {
    const policy: RetryPolicy = { seed: "human-seed", maxRetries: 2, baseDelayMs: 1, ceilingMs: 50 };
    let err: unknown;
    try {
      await runWithDeterministicRetry(async () => { throw new Error("deadlock"); }, policy);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RetryExhaustedError);
    const msg = (err as RetryExhaustedError).message.toLowerCase();
    expect(msg).toMatch(/human|manual|intervention|intervenção/i);
  });

  it("should include the number of attempts in the RetryExhaustedError", async () => {
    const policy: RetryPolicy = { seed: "count-seed", maxRetries: 3, baseDelayMs: 1, ceilingMs: 100 };
    let err: unknown;
    try {
      await runWithDeterministicRetry(async () => { throw new Error("fail"); }, policy);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RetryExhaustedError);
    const retryErr = err as RetryExhaustedError;
    expect(retryErr.attempts).toBe(3);
  });

  it("should respect the delay ceiling and not exceed it", () => {
    const policy: RetryPolicy = { seed: "ceil-check", maxRetries: 10, baseDelayMs: 100, ceilingMs: 150 };
    const delays = computeRetryDelays(policy);
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(150);
    }
  });
});
