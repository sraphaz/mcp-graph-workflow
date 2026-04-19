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
import { runTests } from "../core/harness/test-runner.js";

describe("Test Runner — Vitest JSON runner (Wiener Closed-Loop)", () => {
  it("should return passed=N, failed=0 for a passing test file", async () => {
    // Use our own migration test as a known-passing fixture
    const result = await runTests(
      ["src/tests/migration-46-contract-violations.test.ts"],
      { timeoutMs: 30000 },
    );

    expect(result.success).toBe(true);
    expect(result.passed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("should return failed=N with errors for a failing test", async () => {
    // Use a non-existent file to trigger vitest failure
    const result = await runTests(
      ["src/tests/__nonexistent_test_file__.test.ts"],
      { timeoutMs: 15000 },
    );

    // Vitest returns error for non-existent files
    expect(result.success).toBe(false);
  });

  it("should handle timeout gracefully without crashing parent process", async () => {
    // 1ms timeout — should fail before vitest even starts
    const result = await runTests(
      ["src/tests/migration-46-contract-violations.test.ts"],
      { timeoutMs: 1 },
    );

    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it("should return proper structure with all required fields", async () => {
    const result = await runTests(
      ["src/tests/migration-46-contract-violations.test.ts"],
      { timeoutMs: 30000 },
    );

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("failed");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("timedOut");
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
