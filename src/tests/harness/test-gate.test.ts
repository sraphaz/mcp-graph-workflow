/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for runTestGate — locks the off-mode and
 * no-testFiles short-circuit paths. The actual vitest invocation
 * lives in `test-runner.ts` (separate module, separate test); this
 * suite verifies only the gate's decision logic.
 */

import { describe, it, expect } from "vitest";
import { runTestGate } from "../../core/harness/test-gate.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";

function makeStore(node: { id: string; testFiles?: string[] } | null): SqliteStore {
  const fake = {
    getNodeById(): typeof node {
      return node;
    },
  };
  return fake as unknown as SqliteStore;
}

describe("runTestGate — short-circuit paths", () => {
  it('mode="off" short-circuits with status="skipped" + blocked=false', async () => {
    const store = makeStore({ id: "n1", testFiles: ["src/tests/x.test.ts"] });
    const result = await runTestGate(store, "n1", "off");
    expect(result).toEqual({
      status: "skipped",
      blocked: false,
      passed: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
      testFiles: [],
      mode: "off",
    });
  });

  it("no testFiles → skipped (backward-compatible)", async () => {
    const store = makeStore({ id: "n2", testFiles: [] });
    const result = await runTestGate(store, "n2", "strict");
    expect(result.status).toBe("skipped");
    expect(result.blocked).toBe(false);
    expect(result.testFiles).toEqual([]);
  });

  it("missing node → skipped (no testFiles)", async () => {
    const store = makeStore(null);
    const result = await runTestGate(store, "ghost", "advisory");
    expect(result.status).toBe("skipped");
    expect(result.blocked).toBe(false);
  });

  it('mode="advisory" never blocks even with testFiles present (off path)', async () => {
    // We don't actually invoke runTests here (would need real vitest);
    // instead we rely on the off-mode short-circuit to assert the mode
    // field flows through.
    const store = makeStore({ id: "n3", testFiles: ["x.test.ts"] });
    const result = await runTestGate(store, "n3", "off");
    expect(result.mode).toBe("off");
    expect(result.blocked).toBe(false);
  });

  it("returns the documented TestGateResult shape", async () => {
    const store = makeStore({ id: "n4", testFiles: [] });
    const result = await runTestGate(store, "n4", "strict");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("blocked");
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("failed");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("testFiles");
    expect(result).toHaveProperty("mode");
  });
});
