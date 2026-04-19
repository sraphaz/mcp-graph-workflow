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
 * Retry Executor — generic retry wrapper with exponential backoff + jitter.
 * Inspired by hermes-agent retry with jittered backoff pattern.
 * Uses error-classifier to determine retryability.
 */

import { classifyError, calculateBackoff, type ErrorClassification, type ErrorCategory } from "./error-classifier.js";
import { logger } from "./logger.js";

export interface RetryOptions {
  maxAttempts: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  retryableCategories?: Set<ErrorCategory>;
  onRetry?: (attempt: number, error: Error, classification: ErrorClassification) => void;
}

/**
 * Execute a function with automatic retry for retryable errors.
 * Uses error-classifier to determine if an error should trigger a retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, baseBackoffMs = 200, maxBackoffMs = 30_000, retryableCategories, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const classification = classifyError(lastError);

      // Determine if retryable
      const isRetryable = retryableCategories
        ? retryableCategories.has(classification.category)
        : classification.retryable;

      const isLastAttempt = attempt === maxAttempts - 1;

      if (!isRetryable || isLastAttempt) {
        logger.debug("retry-executor:exhausted", {
          attempts: attempt + 1,
          category: classification.category,
          retryable: isRetryable,
        });
        throw lastError;
      }

      // Calculate backoff and wait
      const delay = calculateBackoff(attempt, baseBackoffMs, maxBackoffMs);

      if (onRetry) {
        onRetry(attempt, lastError, classification);
      }

      logger.debug("retry-executor:retry", {
        attempt: attempt + 1,
        maxAttempts,
        category: classification.category,
        delayMs: Math.round(delay),
      });

      await sleep(delay);
    }
  }

  throw lastError ?? new Error("withRetry: no attempts made");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
