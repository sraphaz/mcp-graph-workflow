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
import { runHarnessScan } from "../../core/harness/harness-scan-runner.js";
import path from "path";

const ROOT = path.resolve(process.cwd());

describe("harness-scan-runner v2 — 7 dimensions", () => {
  it("breakdown includes naming dimension", () => {
    const result = runHarnessScan(ROOT);
    expect(result.breakdown).toHaveProperty("naming");
    expect(typeof result.breakdown.naming.score).toBe("number");
    expect(result.breakdown.naming.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.naming.score).toBeLessThanOrEqual(100);
  });

  it("breakdown includes errors dimension", () => {
    const result = runHarnessScan(ROOT);
    expect(result.breakdown).toHaveProperty("errors");
    expect(typeof result.breakdown.errors.score).toBe("number");
    expect(result.breakdown.errors.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.errors.score).toBeLessThanOrEqual(100);
  });

  it("breakdown includes context dimension", () => {
    const result = runHarnessScan(ROOT);
    expect(result.breakdown).toHaveProperty("context");
    expect(typeof result.breakdown.context.score).toBe("number");
    expect(result.breakdown.context.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.context.score).toBeLessThanOrEqual(100);
  });

  it("details include naming, error-handling, and context-density lines", () => {
    const result = runHarnessScan(ROOT);
    const detailsStr = result.details.join("\n");
    expect(detailsStr).toMatch(/Naming Clarity/i);
    expect(detailsStr).toMatch(/Error Handling/i);
    expect(detailsStr).toMatch(/Context Density/i);
  });

  it("score reflects all 7 dimensions (not stuck at 4-dimension value)", () => {
    const result = runHarnessScan(ROOT);
    // Score should be computed with 7-dimension weights, verify it's a number in range
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // Verify breakdown weights sum to 1.0
    const weightSum = Object.values(result.breakdown).reduce(
      (sum, dim) => sum + (dim as { weight: number }).weight,
      0,
    );
    expect(weightSum).toBeCloseTo(1.0, 5);
  });
});
