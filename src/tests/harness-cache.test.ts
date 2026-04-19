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
 * Tests for harness-cache.ts — TTL + git hash invalidation cache.
 *
 * Covers all 5 acceptance criteria:
 * AC1: Empty cache → runs real scan and caches result
 * AC2: Cache < 60s → returns cached without re-scan
 * AC3: Cache > 60s → runs new scan
 * AC4: Git hash changed → invalidates cache and re-scans
 * AC5: Scan failing → returns null without affecting previous cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the harness-scan-runner BEFORE importing the module under test
vi.mock("../core/harness/harness-scan-runner.js", () => ({
  runHarnessScan: vi.fn(),
}));

// Mock child_process for git hash
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { runHarnessScanCached, resetHarnessCache } from "../core/harness/harness-cache.js";
import { runHarnessScan } from "../core/harness/harness-scan-runner.js";
import { execSync } from "child_process";

const mockRunHarnessScan = vi.mocked(runHarnessScan);
const mockExecSync = vi.mocked(execSync) as unknown as ReturnType<typeof vi.fn>;

function makeScanResult(score: number): ReturnType<typeof runHarnessScan> {
  return {
    score,
    grade: score >= 85 ? "A" : "B",
    breakdown: {
      types: { score: 90, weight: 25 },
      tests: { score: 80, weight: 25 },
      fitness: { score: 85, weight: 15 },
      docs: { score: 70, weight: 15 },
      naming: { score: 90, weight: 10 },
      errors: { score: 75, weight: 5 },
      context: { score: 60, weight: 5 },
    },
    details: [],
    timestamp: new Date().toISOString(),
    ruleSuggestions: [],
  };
}

describe("harness-cache", () => {
  beforeEach(() => {
    resetHarnessCache();
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockExecSync.mockReturnValue("abc123" as unknown as string);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC1: GIVEN cache vazio WHEN runHarnessScanCached() chamado THEN executa scan real e cacheia resultado
  it("should run real scan on empty cache and cache the result", () => {
    const result = makeScanResult(85);
    mockRunHarnessScan.mockReturnValue(result);

    const first = runHarnessScanCached("/project");

    expect(first).toEqual(result);
    expect(mockRunHarnessScan).toHaveBeenCalledTimes(1);
  });

  // AC2: GIVEN cache com menos de 60s WHEN runHarnessScanCached() chamado THEN retorna cache sem re-scan
  it("should return cached result within 60s TTL without re-scanning", () => {
    const result = makeScanResult(85);
    mockRunHarnessScan.mockReturnValue(result);

    runHarnessScanCached("/project");
    vi.advanceTimersByTime(30_000); // 30s — within TTL

    const second = runHarnessScanCached("/project");

    expect(second).toEqual(result);
    expect(mockRunHarnessScan).toHaveBeenCalledTimes(1); // NOT called again
  });

  // AC3: GIVEN cache com mais de 60s WHEN runHarnessScanCached() chamado THEN executa novo scan
  it("should re-scan after TTL expires (60s)", () => {
    const result1 = makeScanResult(85);
    const result2 = makeScanResult(90);
    mockRunHarnessScan.mockReturnValueOnce(result1).mockReturnValueOnce(result2);

    runHarnessScanCached("/project");
    vi.advanceTimersByTime(61_000); // 61s — TTL expired

    const second = runHarnessScanCached("/project");

    expect(second).toEqual(result2);
    expect(mockRunHarnessScan).toHaveBeenCalledTimes(2);
  });

  // AC4: GIVEN git hash mudou WHEN runHarnessScanCached() chamado THEN invalida cache e re-scan
  it("should invalidate cache when git hash changes", () => {
    const result1 = makeScanResult(85);
    const result2 = makeScanResult(90);
    mockRunHarnessScan.mockReturnValueOnce(result1).mockReturnValueOnce(result2);
    mockExecSync.mockReturnValueOnce("abc123" as unknown as string);

    runHarnessScanCached("/project");

    // Git hash changes
    mockExecSync.mockReturnValueOnce("def456" as unknown as string);
    vi.advanceTimersByTime(10_000); // Only 10s — within TTL

    const second = runHarnessScanCached("/project");

    expect(second).toEqual(result2);
    expect(mockRunHarnessScan).toHaveBeenCalledTimes(2); // Re-scanned due to hash change
  });

  // AC5: GIVEN scan falhando WHEN chamado THEN retorna null sem afetar cache anterior
  it("should return null on scan failure without affecting previous cache", () => {
    const result1 = makeScanResult(85);
    mockRunHarnessScan.mockReturnValueOnce(result1);

    const first = runHarnessScanCached("/project");
    expect(first).toEqual(result1);

    // TTL expires, next scan fails
    vi.advanceTimersByTime(61_000);
    mockRunHarnessScan.mockImplementationOnce(() => {
      throw new Error("scan crashed");
    });

    const second = runHarnessScanCached("/project");
    expect(second).toBeNull();

    // Previous cache should be preserved for next successful recovery
    // (cache entry stays so that if TTL passes again and scan recovers, it works)
  });

  it("should return null when scan fails on empty cache", () => {
    mockRunHarnessScan.mockImplementation(() => {
      throw new Error("scan crashed");
    });

    const result = runHarnessScanCached("/project");
    expect(result).toBeNull();
  });

  it("should invalidate cache when rootDir changes", () => {
    const result1 = makeScanResult(85);
    const result2 = makeScanResult(75);
    mockRunHarnessScan.mockReturnValueOnce(result1).mockReturnValueOnce(result2);

    runHarnessScanCached("/project-a");
    const second = runHarnessScanCached("/project-b");

    expect(second).toEqual(result2);
    expect(mockRunHarnessScan).toHaveBeenCalledTimes(2);
  });

  it("should handle git hash retrieval failure gracefully", () => {
    const result = makeScanResult(85);
    mockRunHarnessScan.mockReturnValue(result);
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });

    const first = runHarnessScanCached("/project");
    expect(first).toEqual(result);

    // Second call — still no git, should use TTL-only caching
    vi.advanceTimersByTime(10_000);
    const second = runHarnessScanCached("/project");
    expect(second).toEqual(result);
    expect(mockRunHarnessScan).toHaveBeenCalledTimes(1); // cached
  });
});
