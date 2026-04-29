/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import type { ProviderAdapter } from "../core/llm/adapters/base.js";
import { withRetry, type RetryConfig } from "../core/llm/retry.js";

const fastRetry: RetryConfig = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 4 };

describe("core/llm/adapters/base — ProviderAdapter interface", () => {
  it("type can be implemented by a stub object", () => {
    const stub: ProviderAdapter = {
      name: "openrouter",
      generate: async () => ({
        model: "x/y",
        content: "ok",
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
      models: () => [],
    };
    expect(stub.name).toBe("openrouter");
  });
});

describe("core/llm/retry — withRetry", () => {
  it("returns the result on first success", async () => {
    const result = await withRetry(async () => 42, fastRetry);
    expect(result).toBe(42);
  });

  it("retries on transient errors and returns success on attempt 3", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        const err = new Error("transient") as Error & { status: number };
        err.status = 503;
        throw err;
      }
      return "ok";
    }, fastRetry);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("rethrows after exhausting maxAttempts", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        const err = new Error("upstream 502") as Error & { status: number };
        err.status = 502;
        throw err;
      }, fastRetry),
    ).rejects.toThrow("upstream 502");
    expect(attempts).toBe(3);
  });

  it("does NOT retry on non-retryable status (e.g. 401)", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        const err = new Error("auth") as Error & { status: number };
        err.status = 401;
        throw err;
      }, fastRetry),
    ).rejects.toThrow("auth");
    expect(attempts).toBe(1);
  });

  it("retries on status 0 (network error)", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new Error("ECONNRESET");
      }, fastRetry),
    ).rejects.toThrow("ECONNRESET");
    expect(attempts).toBe(3);
  });
});
