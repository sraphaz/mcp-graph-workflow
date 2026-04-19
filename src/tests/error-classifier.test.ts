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

import { describe, it, expect } from "vitest";
import {
  classifyError,
  calculateBackoff,
  ERROR_CATEGORIES,
} from "../core/utils/error-classifier.js";

describe("classifyError", () => {
  it("should classify 429 as rate_limit", () => {
    const result = classifyError(new Error("429 Too Many Requests"));

    expect(result.category).toBe("rate_limit");
    expect(result.retryable).toBe(true);
  });

  it("should classify SQLITE_BUSY as database", () => {
    const result = classifyError(new Error("SQLITE_BUSY: database is locked"));

    expect(result.category).toBe("database");
    expect(result.retryable).toBe(true);
  });

  it("should classify Cannot find module as module", () => {
    const result = classifyError(new Error("Cannot find module './foo.js'"));

    expect(result.category).toBe("module");
    expect(result.retryable).toBe(false);
  });

  it("should classify ECONNRESET as network", () => {
    const result = classifyError(new Error("ECONNRESET: connection reset"));

    expect(result.category).toBe("network");
    expect(result.retryable).toBe(true);
  });

  it("should classify timeout errors as timeout", () => {
    const result = classifyError(new Error("Request timeout after 30000ms"));

    expect(result.category).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("should classify auth errors as auth_expired", () => {
    const result = classifyError(new Error("401 Unauthorized"));

    expect(result.category).toBe("auth_expired");
    expect(result.retryable).toBe(false);
  });

  it("should classify context length errors as context_overflow", () => {
    const result = classifyError(new Error("maximum context length exceeded"));

    expect(result.category).toBe("context_overflow");
    expect(result.retryable).toBe(false);
  });

  it("should classify validation errors as validation", () => {
    const result = classifyError(new Error("Validation failed: invalid input"));

    expect(result.category).toBe("validation");
    expect(result.retryable).toBe(false);
  });

  it("should classify test failures as test", () => {
    const result = classifyError(new Error("Test failed: expected 1 to equal 2"));

    expect(result.category).toBe("test");
    expect(result.retryable).toBe(false);
  });

  it("should classify build errors as build", () => {
    const result = classifyError(new Error("TS2307: Cannot find module"));

    expect(result.category).toBe("build");
    expect(result.retryable).toBe(false);
  });

  it("should classify unknown errors as general", () => {
    const result = classifyError(new Error("Something completely unexpected"));

    expect(result.category).toBe("general");
    expect(result.retryable).toBe(false);
  });

  it("should include suggested action", () => {
    const result = classifyError(new Error("429 Too Many Requests"));

    expect(result.suggestedAction).toBeDefined();
    expect(typeof result.suggestedAction).toBe("string");
  });

  it("should handle non-Error objects", () => {
    const result = classifyError("string error" as unknown as Error);

    expect(result.category).toBe("general");
  });
});

describe("calculateBackoff", () => {
  it("should return value in expected range for attempt 0", () => {
    const backoff = calculateBackoff(0, 100);

    expect(backoff).toBeGreaterThanOrEqual(100);
    expect(backoff).toBeLessThanOrEqual(200);
  });

  it("should increase exponentially", () => {
    const _b0 = calculateBackoff(0, 100);
    const b3 = calculateBackoff(3, 100);

    // attempt 3 base = 100 * 2^3 = 800, with jitter up to 1600
    expect(b3).toBeGreaterThanOrEqual(800);
    expect(b3).toBeLessThanOrEqual(1600);
  });

  it("should cap at maxMs", () => {
    const backoff = calculateBackoff(10, 100, 5000);

    expect(backoff).toBeLessThanOrEqual(5000);
  });

  it("should use default baseMs of 200", () => {
    const backoff = calculateBackoff(0);

    expect(backoff).toBeGreaterThanOrEqual(200);
    expect(backoff).toBeLessThanOrEqual(400);
  });
});

describe("ERROR_CATEGORIES", () => {
  it("should have 12 categories defined", () => {
    expect(ERROR_CATEGORIES.size).toBe(12);
  });
});
