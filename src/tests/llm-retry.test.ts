/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for llm/retry.ts — the retry helper used by
 * every LLM adapter. Locks the retryable / non-retryable contract,
 * the exponential backoff cap, and final-error short-circuiting.
 */

import { describe, it, expect } from "vitest";
import { withRetry, DEFAULT_RETRY, type RetryConfig } from "../core/llm/retry.js";
import {
  LlmAuthError,
  LlmContextWindowError,
  LlmModelUnknown,
} from "../core/llm/errors.js";

const FAST: RetryConfig = { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 };

describe("withRetry — happy path", () => {
  it("returns the result on first-attempt success", async () => {
    const result = await withRetry(async () => 42, FAST);
    expect(result).toBe(42);
  });

  it("retries on retryable status and eventually succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        const err = new Error("boom") as Error & { status: number };
        err.status = 503;
        throw err;
      }
      return "ok";
    }, FAST);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});

describe("withRetry — non-retryable cases short-circuit", () => {
  it("LlmAuthError is final — first throw bubbles, no retry", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new LlmAuthError("anthropic", "401 unauthorized");
      }, FAST),
    ).rejects.toBeInstanceOf(LlmAuthError);
    expect(attempts).toBe(1);
  });

  it("LlmContextWindowError is final", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new LlmContextWindowError("claude-opus-4-7", 250_000, 200_000);
      }, FAST),
    ).rejects.toBeInstanceOf(LlmContextWindowError);
    expect(attempts).toBe(1);
  });

  it("LlmModelUnknown is final", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new LlmModelUnknown("definitely-not-a-model");
      }, FAST),
    ).rejects.toBeInstanceOf(LlmModelUnknown);
    expect(attempts).toBe(1);
  });
});

describe("withRetry — status code matrix", () => {
  it.each([
    [400, false], // client error not in retry list
    [401, false],
    [403, false],
    [404, false],
    [422, false],
    [429, true],
    [500, true],
    [502, true],
    [503, true],
    [504, true],
    [599, true],
    [600, false], // outside 5xx
    [0, true], // network error sentinel
  ])("status %i → retryable=%s", async (status, shouldRetry) => {
    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      const err = new Error(`status ${status}`) as Error & { status: number };
      err.status = status;
      throw err;
    };
    await expect(withRetry(fn, FAST)).rejects.toBeDefined();
    expect(attempts).toBe(shouldRetry ? FAST.maxAttempts : 1);
  });

  it("error without status is treated as retryable (network/generic)", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new Error("ECONNRESET");
      }, FAST),
    ).rejects.toThrow(/ECONNRESET/);
    expect(attempts).toBe(FAST.maxAttempts);
  });
});

describe("withRetry — backoff cap", () => {
  it("respects maxDelayMs (no test of actual delay; just contract)", async () => {
    // The point of this test is structural — we don't sleep in tests.
    // We confirm withRetry runs all attempts up to maxAttempts when the
    // operation never succeeds, even with a configured maxDelayMs.
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          const err = new Error("503") as Error & { status: number };
          err.status = 503;
          throw err;
        },
        { maxAttempts: 4, baseDelayMs: 0, maxDelayMs: 1 },
      ),
    ).rejects.toBeDefined();
    expect(attempts).toBe(4);
  });

  it("DEFAULT_RETRY exposes the documented constants", () => {
    expect(DEFAULT_RETRY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY.baseDelayMs).toBe(500);
    expect(DEFAULT_RETRY.maxDelayMs).toBe(8000);
  });
});
