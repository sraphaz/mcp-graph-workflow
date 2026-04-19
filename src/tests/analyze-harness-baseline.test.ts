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
 * TDD: Harness baseline hint in ANALYZE phase lifecycle block.
 * Validates that buildLifecycleBlock suggests harness_scan when in ANALYZE phase without baseline.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphDocument } from "../core/graph/graph-types.js";
import { buildLifecycleBlock } from "../mcp/unified-gate.js";

// Mock harness cache
vi.mock("../core/harness/harness-cache.js", () => ({
  runHarnessScanCached: vi.fn(),
}));

import { runHarnessScanCached } from "../core/harness/harness-cache.js";
const mockHarnessScan = vi.mocked(runHarnessScanCached);

function makeEmptyDoc(): GraphDocument {
  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: [],
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("ANALYZE phase — harness baseline hint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should suggest harness_scan when no harness data in ANALYZE phase", () => {
    mockHarnessScan.mockReturnValue(null);

    const doc = makeEmptyDoc();
    const block = buildLifecycleBlock(doc, { phaseOverride: "ANALYZE" });

    // In ANALYZE phase without harness data, should suggest establishing baseline
    expect(block.phase).toBe("ANALYZE");
    expect(block.harness).toBeUndefined();
    // The suggestedNext should include harness scan recommendation
    const hasHarnessHint = block.suggestedNext.some((s) => s.includes("harness"));
    expect(hasHarnessHint || block.harnessBaselineHint !== undefined).toBe(true);
  });

  it("should NOT suggest harness_scan when harness data exists", () => {
    mockHarnessScan.mockReturnValue({
      score: 72,
      grade: "B",
      breakdown: {},
      details: [],
      timestamp: "2026-01-01",
      ruleSuggestions: [],
    } as unknown as ReturnType<typeof runHarnessScanCached>);

    const doc = makeEmptyDoc();
    const block = buildLifecycleBlock(doc, { phaseOverride: "ANALYZE" });

    expect(block.harness).toBeDefined();
    expect(block.harness!.score).toBe(72);
    // No baseline hint needed when data exists
    expect(block.harnessBaselineHint).toBeUndefined();
  });
});
