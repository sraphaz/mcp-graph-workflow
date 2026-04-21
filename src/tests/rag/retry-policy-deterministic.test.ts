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
 * Tests for deterministic retry rule with configurable threshold.
 *
 * node_ab109adf5018 — "Regra de retry deterministica com limiar configuravel"
 * Parent: Inclui — wave-03
 *
 * RetryPolicy encapsulates: confidenceThreshold + maxRetries.
 * shouldRetry(signal, retryCount) is deterministic: same inputs → same output.
 */

import { describe, it, expect } from "vitest";
import {
  createRetryPolicy,
  shouldRetry,
  DEFAULT_RETRY_POLICY,
} from "../../core/rag/corrective-rag.js";
import type { RetryPolicy } from "../../core/rag/corrective-rag.js";

function makeSignal(composite: number, mean = composite, min = composite, count = 1) {
  return { composite, mean, min, count };
}

describe("RetryPolicy — deterministic rule with configurable threshold", () => {
  describe("createRetryPolicy", () => {
    it("should create a policy with the given threshold and maxRetries", () => {
      const policy = createRetryPolicy({ confidenceThreshold: 0.6, maxRetries: 1 });
      expect(policy.confidenceThreshold).toBe(0.6);
      expect(policy.maxRetries).toBe(1);
    });

    it("should use sensible defaults when omitting options", () => {
      const policy = createRetryPolicy();
      expect(policy.confidenceThreshold).toBeGreaterThan(0);
      expect(policy.maxRetries).toBeGreaterThanOrEqual(1);
    });
  });

  describe("DEFAULT_RETRY_POLICY", () => {
    it("should have maxRetries = 1 (single retry per query)", () => {
      expect(DEFAULT_RETRY_POLICY.maxRetries).toBe(1);
    });

    it("should have confidenceThreshold = 0.5", () => {
      expect(DEFAULT_RETRY_POLICY.confidenceThreshold).toBe(0.5);
    });
  });

  describe("shouldRetry — determinism", () => {
    it("same inputs always produce the same output", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 1 };
      const signal = makeSignal(0.3);
      const a = shouldRetry(signal, 0, policy);
      const b = shouldRetry(signal, 0, policy);
      expect(a).toBe(b);
    });
  });

  describe("shouldRetry — low confidence triggers retry", () => {
    it("should return true when confidence < threshold and retries not exhausted", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 1 };
      expect(shouldRetry(makeSignal(0.2), 0, policy)).toBe(true);
    });

    it("should return false when confidence >= threshold", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 1 };
      expect(shouldRetry(makeSignal(0.7), 0, policy)).toBe(false);
    });

    it("should return false when confidence equals threshold", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 1 };
      expect(shouldRetry(makeSignal(0.5), 0, policy)).toBe(false);
    });
  });

  describe("shouldRetry — maxRetries enforcement", () => {
    it("should return false when retryCount >= maxRetries even if confidence is low", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 1 };
      expect(shouldRetry(makeSignal(0.1), 1, policy)).toBe(false);
    });

    it("should allow retry when retryCount < maxRetries", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 2 };
      expect(shouldRetry(makeSignal(0.1), 1, policy)).toBe(true);
    });

    it("should never retry when maxRetries is 0", () => {
      const policy: RetryPolicy = { confidenceThreshold: 0.5, maxRetries: 0 };
      expect(shouldRetry(makeSignal(0.0), 0, policy)).toBe(false);
    });
  });
});
