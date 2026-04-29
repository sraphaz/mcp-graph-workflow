/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B4 — budget-aware task selection tests.
 */

import { describe, it, expect } from "vitest";
import {
  pickBudgetAwareTask,
  isBudgetLow,
  isBudgetAwareDisabled,
  LOW_BUDGET_THRESHOLD,
  type CandidateTask,
} from "../core/autonomy/budget-aware-picker.js";

describe("budget-aware-picker (E22.B4)", () => {
  it("LOW_BUDGET_THRESHOLD = 0.2", () => {
    expect(LOW_BUDGET_THRESHOLD).toBe(0.2);
  });

  it("isBudgetLow false when no cap", () => {
    expect(isBudgetLow({ capUsdPerRun: undefined, totalUsd: 999 })).toBe(false);
    expect(isBudgetLow({ capUsdPerRun: 0, totalUsd: 999 })).toBe(false);
  });

  it("isBudgetLow true when remaining < 20%", () => {
    expect(isBudgetLow({ capUsdPerRun: 1.0, totalUsd: 0.85 })).toBe(true);
  });

  it("isBudgetLow false when remaining >= 20%", () => {
    expect(isBudgetLow({ capUsdPerRun: 1.0, totalUsd: 0.5 })).toBe(false);
    expect(isBudgetLow({ capUsdPerRun: 1.0, totalUsd: 0.8 })).toBe(false);
  });

  it("returns null on empty list", () => {
    expect(pickBudgetAwareTask([], { capUsdPerRun: 1, totalUsd: 0 })).toBeNull();
  });

  it("picks highest priority (lowest number) when budget OK", () => {
    const candidates: CandidateTask[] = [
      { id: "a", xpSize: "M", priority: 3 },
      { id: "b", xpSize: "L", priority: 1 },
      { id: "c", xpSize: "XS", priority: 5 },
    ];
    const picked = pickBudgetAwareTask(candidates, { capUsdPerRun: 1, totalUsd: 0.1 });
    expect(picked?.id).toBe("b");
  });

  it("prefers XS/S when budget low (90% spent + 2 XS + 3 M → picker pega XS)", () => {
    const candidates: CandidateTask[] = [
      { id: "m1", xpSize: "M", priority: 1 },
      { id: "m2", xpSize: "M", priority: 1 },
      { id: "m3", xpSize: "M", priority: 1 },
      { id: "xs1", xpSize: "XS", priority: 3 },
      { id: "xs2", xpSize: "XS", priority: 3 },
    ];
    const picked = pickBudgetAwareTask(candidates, { capUsdPerRun: 1.0, totalUsd: 0.9 });
    expect(picked?.xpSize).toBe("XS");
    expect(picked?.id).toBe("xs1");
  });

  it("prefers S over M when low budget AND S/M both available", () => {
    const candidates: CandidateTask[] = [
      { id: "m", xpSize: "M", priority: 1 },
      { id: "s", xpSize: "S", priority: 5 },
    ];
    const picked = pickBudgetAwareTask(candidates, { capUsdPerRun: 1.0, totalUsd: 0.95 });
    expect(picked?.id).toBe("s");
  });

  it("falls back to all when no XS/S available even under low budget", () => {
    const candidates: CandidateTask[] = [
      { id: "m", xpSize: "M", priority: 1 },
      { id: "l", xpSize: "L", priority: 2 },
    ];
    const picked = pickBudgetAwareTask(candidates, { capUsdPerRun: 1.0, totalUsd: 0.95 });
    expect(picked?.id).toBe("m");
  });

  it("secondary sort by depth ASC", () => {
    const candidates: CandidateTask[] = [
      { id: "deep", xpSize: "XS", priority: 1, depth: 5 },
      { id: "shallow", xpSize: "XS", priority: 1, depth: 1 },
    ];
    const picked = pickBudgetAwareTask(candidates, { capUsdPerRun: 1, totalUsd: 0 });
    expect(picked?.id).toBe("shallow");
  });

  it("isBudgetAwareDisabled respects MCP_GRAPH_BUDGET_AWARE=off", () => {
    expect(isBudgetAwareDisabled({ MCP_GRAPH_BUDGET_AWARE: "off" })).toBe(true);
    expect(isBudgetAwareDisabled({})).toBe(false);
  });
});
