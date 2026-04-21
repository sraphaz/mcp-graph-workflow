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
 * Task 6.2: Gate de regressao > 5 pontos no finish_task.
 * node_5e5c2cac785b
 *
 * AC1: score 78 → 72 in strict → gate blocks (delta = -6 > threshold -5).
 * AC2: queda with override reason → accepted, override recorded.
 * AC3: advisory mode → warning without blocking.
 */

import { describe, it, expect } from "vitest";
import {
  checkHarnessRegressionGate,
  type HarnessGateResult,
} from "../../core/harness/harness-preflight.js";

describe("checkHarnessRegressionGate — AC1 (strict blocks)", () => {
  it("should block when drop > 5 points in strict mode", () => {
    const result: HarnessGateResult = checkHarnessRegressionGate(78, 72, "strict");
    expect(result.blocked).toBe(true);
    expect(result.delta).toBe(-6);
  });

  it("should block when drop is exactly 5.1 points in strict mode", () => {
    const result = checkHarnessRegressionGate(80, 74.9, "strict");
    expect(result.blocked).toBe(true);
  });

  it("should NOT block when drop is exactly 5 points in strict mode (threshold is exclusive)", () => {
    const result = checkHarnessRegressionGate(80, 75, "strict");
    expect(result.blocked).toBe(false);
  });

  it("should NOT block when score improves in strict mode", () => {
    const result = checkHarnessRegressionGate(70, 80, "strict");
    expect(result.blocked).toBe(false);
    expect(result.delta).toBe(10);
  });

  it("should return correct before/after/delta values", () => {
    const result = checkHarnessRegressionGate(78, 72, "strict");
    expect(result.startScore).toBe(78);
    expect(result.endScore).toBe(72);
    expect(result.delta).toBe(-6);
    expect(result.mode).toBe("strict");
  });
});

describe("checkHarnessRegressionGate — AC2 (override)", () => {
  it("should NOT block when override reason provided, even with large drop in strict", () => {
    const result = checkHarnessRegressionGate(90, 70, "strict", 5, "Intentional: removed typed-any to adopt runtime-validated Zod schema");
    expect(result.blocked).toBe(false);
    expect(result.overrideReason).toBeDefined();
    expect(result.delta).toBe(-20);
  });

  it("should include the override reason in result", () => {
    const reason = "Removed unused exports — naming clarity dimension impacted";
    const result = checkHarnessRegressionGate(80, 72, "strict", 5, reason);
    expect(result.overrideReason).toBe(reason);
  });
});

describe("checkHarnessRegressionGate — AC3 (advisory warns without blocking)", () => {
  it("should warn but NOT block in advisory mode with drop > 5", () => {
    const result = checkHarnessRegressionGate(78, 72, "advisory");
    expect(result.blocked).toBe(false);
    expect(result.delta).toBe(-6);
    expect(result.mode).toBe("advisory");
  });

  it("should never block in off mode regardless of drop", () => {
    const result = checkHarnessRegressionGate(100, 50, "off");
    expect(result.blocked).toBe(false);
  });
});
