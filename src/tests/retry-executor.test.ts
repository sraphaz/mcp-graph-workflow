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

import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../core/utils/retry-executor.js";

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, { maxAttempts: 3 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error and succeed", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxAttempts: 3, baseBackoffMs: 1 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("429 Too Many Requests"));

    await expect(withRetry(fn, { maxAttempts: 3, baseBackoffMs: 1 })).rejects.toThrow("429");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Cannot find module"));

    await expect(withRetry(fn, { maxAttempts: 3, baseBackoffMs: 1 })).rejects.toThrow("Cannot find module");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should call onRetry callback on each retry", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValue("ok");

    await withRetry(fn, { maxAttempts: 3, baseBackoffMs: 1, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Number), expect.any(Error), expect.any(Object));
  });

  it("should respect custom retryable categories", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("validation failed"));

    // validation is not retryable by default, but we can override
    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseBackoffMs: 1,
        retryableCategories: new Set(["validation"]),
      }),
    ).rejects.toThrow("validation");

    // With validation in retryable set, should retry all 3 times
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should handle sync functions wrapped in async", async () => {
    let calls = 0;
    const fn = async (): Promise<string> => {
      calls++;
      if (calls < 2) throw new Error("SQLITE_BUSY");
      return "done";
    };

    const result = await withRetry(fn, { maxAttempts: 3, baseBackoffMs: 1 });
    expect(result).toBe("done");
  });
});
