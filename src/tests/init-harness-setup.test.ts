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
 * TDD: Harness baseline in init tool.
 * Validates that init includes harness baseline scan result.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";

// Mock the harness scan runner to avoid real filesystem scan in tests
vi.mock("../core/harness/harness-scan-runner.js", () => ({
  runHarnessScan: vi.fn(),
}));

import { runHarnessScan } from "../core/harness/harness-scan-runner.js";
const mockRunHarnessScan = vi.mocked(runHarnessScan);

// Import after mock
import { initWithHarnessBaseline } from "../core/pipeline/init-harness.js";

describe("init — harness baseline", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    vi.clearAllMocks();
  });

  afterEach(() => {
    store.close();
  });

  it("should return harnessBaseline with score/grade when scan succeeds", () => {
    mockRunHarnessScan.mockReturnValue({
      score: 66,
      grade: "C",
      breakdown: {},
      details: [],
      timestamp: "2026-01-01",
      ruleSuggestions: [],
    } as unknown as ReturnType<typeof runHarnessScan>);

    const result = initWithHarnessBaseline(store);

    expect(result.harnessBaseline).not.toBeNull();
    expect(result.harnessBaseline!.score).toBe(66);
    expect(result.harnessBaseline!.grade).toBe("C");
  });

  it("should return null harnessBaseline when scan throws", () => {
    mockRunHarnessScan.mockImplementation(() => {
      throw new Error("No source files");
    });

    const result = initWithHarnessBaseline(store);

    expect(result.harnessBaseline).toBeNull();
  });

  it("should always include harnessHint", () => {
    mockRunHarnessScan.mockReturnValue({
      score: 80,
      grade: "B",
      breakdown: {},
      details: [],
      timestamp: "2026-01-01",
      ruleSuggestions: [],
    } as unknown as ReturnType<typeof runHarnessScan>);

    const result = initWithHarnessBaseline(store);

    expect(typeof result.harnessHint).toBe("string");
    expect(result.harnessHint.length).toBeGreaterThan(10);
  });
});
