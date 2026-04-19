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
 * Test Discovery Tests
 *
 * Tests auto-discovery of test files from node titles,
 * used as fallback when node.testFiles is empty.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:fs", () => ({
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { discoverTestFiles } from "../core/harness/test-discovery.js";
import { readdirSync, existsSync } from "node:fs";

const MOCK_TEST_FILES = [
  "property-invariants.test.ts",
  "test-discovery.test.ts",
  "decision-provenance.test.ts",
  "auth-middleware.test.ts",
  "auth.test.ts",
  "foo-bar.test.ts",
  "foo.test.ts",
  "sqlite-store.test.ts",
  "dependency-chain.test.ts",
  "enhanced-next.test.ts",
  "graph-health-scanner.test.ts",
  "deploy-readiness.test.ts",
  "definition-of-done.test.ts",
  "risk-assessment.test.ts",
  "prd-quality.test.ts",
];

function setupMocks(files: string[] = MOCK_TEST_FILES, dirExists = true): void {
  vi.mocked(readdirSync).mockReturnValue(files as unknown as ReturnType<typeof readdirSync>);
  vi.mocked(existsSync).mockReturnValue(dirExists);
}

describe("test-discovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should find test files matching keywords from node title", () => {
    setupMocks();
    const result = discoverTestFiles("Implement foo bar", "/fake");

    expect(result).toContain("src/tests/foo-bar.test.ts");
    expect(result).toContain("src/tests/foo.test.ts");
  });

  it("should find auth-related tests for auth middleware title", () => {
    setupMocks();
    const result = discoverTestFiles("Add auth middleware", "/fake");

    expect(result).toContain("src/tests/auth-middleware.test.ts");
    expect(result).toContain("src/tests/auth.test.ts");
  });

  it("should return empty array when no matches found", () => {
    setupMocks();
    const result = discoverTestFiles("Implement quantum teleportation", "/fake");

    expect(result).toEqual([]);
  });

  it("should filter out common stopwords", () => {
    setupMocks();
    const result = discoverTestFiles("Add the feature to the system", "/fake");

    expect(result).toEqual([]);
  });

  it("should cap results at 20 files", () => {
    const manyFiles = Array.from({ length: 30 }, (_, i) => `test-file-${i}.test.ts`);
    setupMocks(manyFiles);

    const result = discoverTestFiles("test file", "/fake");

    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("should handle kebab-case conversion of title words", () => {
    setupMocks();
    const result = discoverTestFiles("Fix dependency chain bug", "/fake");

    expect(result).toContain("src/tests/dependency-chain.test.ts");
  });

  it("should return empty array when src/tests/ directory does not exist", () => {
    setupMocks(MOCK_TEST_FILES, false);

    const result = discoverTestFiles("Implement foo bar", "/fake");

    expect(result).toEqual([]);
  });
});
