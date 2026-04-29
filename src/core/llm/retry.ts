/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — withRetry helper.
 * Retries on transient HTTP statuses (429, 5xx) and network errors (status 0).
 * Ported from src/core/browser-harness/llm-client.ts to live in the SDK layer.
 */

import { logger } from "../utils/logger.js";
import {
  LlmAuthError,
  LlmContextWindowError,
  LlmModelUnknown,
} from "./errors.js";

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

export const DEFAULT_RETRY: RetryConfig = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 8000 };

/** Final errors — never retry, no point. */
const FINAL_ERRORS = [LlmAuthError, LlmContextWindowError, LlmModelUnknown];

function isRetryable(err: unknown): boolean {
  if (FINAL_ERRORS.some((Cls) => err instanceof Cls)) return false;
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true; // network error / generic — retry
  return status === 0 || status === 429 || (status >= 500 && status < 600);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === config.maxAttempts) throw err;
      const delay = Math.min(
        config.maxDelayMs ?? 8000,
        config.baseDelayMs * 2 ** (attempt - 1),
      );
      logger.warn("llm:retry", {
        attempt,
        status: (err as { status?: number }).status ?? 0,
        delayMs: delay,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
