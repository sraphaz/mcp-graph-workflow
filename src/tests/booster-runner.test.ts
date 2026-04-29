/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T07 — booster-runner tests.
 */

import { describe, it, expect } from "vitest";
import {
  runBooster,
  hasAssociatedTests,
  type BoosterTelemetryRecord,
} from "../core/llm/booster-runner.js";

describe("booster-runner (E6.T07)", () => {
  it("hasAssociatedTests true when testFiles is non-empty", () => {
    expect(hasAssociatedTests([])).toBe(false);
    expect(hasAssociatedTests(["x.test.ts"])).toBe(true);
  });

  it("safety gate: refuses to run when file has no test coverage", () => {
    const records: BoosterTelemetryRecord[] = [];
    const r = runBooster<string>({
      filePath: "src/foo.ts",
      testFiles: [],
      booster: () => "should-not-run",
      telemetry: (r) => records.push(r),
    });
    expect(r.hit).toBe(false);
    expect(r.reason).toContain("safety-gate");
    expect(records[0].outcome).toBe("blocked-no-tests");
  });

  it("hit: returns booster output and records telemetry outcome=hit", () => {
    const records: BoosterTelemetryRecord[] = [];
    const r = runBooster<string>({
      filePath: "src/ok.ts",
      testFiles: ["src/tests/ok.test.ts"],
      booster: () => "TRANSFORMED",
      telemetry: (r) => records.push(r),
    });
    expect(r.hit).toBe(true);
    expect(r.output).toBe("TRANSFORMED");
    expect(records).toHaveLength(1);
    expect(records[0].outcome).toBe("hit");
    expect(records[0].hasTests).toBe(true);
  });

  it("miss: booster returns undefined → fall-through reason + telemetry outcome=miss", () => {
    const records: BoosterTelemetryRecord[] = [];
    const r = runBooster<string>({
      filePath: "src/foo.ts",
      testFiles: ["src/tests/foo.test.ts"],
      booster: () => undefined,
      telemetry: (r) => records.push(r),
    });
    expect(r.hit).toBe(false);
    expect(r.reason).toContain("no-match");
    expect(records[0].outcome).toBe("miss");
  });

  it("error: thrown booster does not propagate; reason carries message", () => {
    const records: BoosterTelemetryRecord[] = [];
    const r = runBooster<string>({
      filePath: "src/foo.ts",
      testFiles: ["src/tests/foo.test.ts"],
      booster: () => {
        throw new Error("kaboom");
      },
      telemetry: (r) => records.push(r),
    });
    expect(r.hit).toBe(false);
    expect(r.reason).toContain("kaboom");
    expect(records[0].outcome).toBe("error");
    expect(records[0].errorMessage).toBe("kaboom");
  });

  it("logs telemetry on every run (hit, miss, blocked, error)", () => {
    const records: BoosterTelemetryRecord[] = [];
    const sink = (r: BoosterTelemetryRecord) => records.push(r);

    runBooster({ filePath: "a", testFiles: [], booster: () => 1, telemetry: sink });
    runBooster({ filePath: "b", testFiles: ["t"], booster: () => 1, telemetry: sink });
    runBooster({ filePath: "c", testFiles: ["t"], booster: () => undefined, telemetry: sink });
    runBooster({
      filePath: "d",
      testFiles: ["t"],
      booster: () => {
        throw new Error("e");
      },
      telemetry: sink,
    });

    expect(records.map((r) => r.outcome)).toEqual([
      "blocked-no-tests",
      "hit",
      "miss",
      "error",
    ]);
  });

  it("missing telemetry callback does not throw", () => {
    expect(() =>
      runBooster({
        filePath: "x",
        testFiles: ["t"],
        booster: () => 1,
      }),
    ).not.toThrow();
  });

  it("durationMs reported in record (>= 0)", () => {
    const records: BoosterTelemetryRecord[] = [];
    runBooster({
      filePath: "x",
      testFiles: ["t"],
      booster: () => 1,
      telemetry: (r) => records.push(r),
    });
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});
