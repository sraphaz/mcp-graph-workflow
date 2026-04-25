/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetParentBridgeForTests,
  setParentRuntimeForTests,
} from "../core/parent-bridge.js";
import { runSetPhase } from "./set-phase.js";

const baseCtx = {
  args: [],
  flags: {},
  mode: "shell" as const,
  traceId: "test-trace",
};

interface FakeOpts {
  result?: unknown;
  throwOnSetPhase?: boolean;
}

function makeRuntime(opts: FakeOpts = {}) {
  const setPhaseCore = vi.fn(() => {
    if (opts.throwOnSetPhase) throw new Error("Graph not initialized");
    return (
      opts.result ?? {
        ok: true,
        action: "override",
        phase: "IMPLEMENT",
        mode: "strict",
        codeIntelligence: "advisory",
        prerequisites: "advisory",
        reminder: "IMPLEMENT: TDD Red→Green→Refactor.",
        phaseSummaryIndexed: false,
      }
    );
  });

  const store = {
    close: vi.fn(),
  };

  return {
    runtime: {
      distRoot: "/fake",
      loadStore: async () => ({
        SqliteStore: { open: () => store },
      }),
      loadPlanner: async () => ({}),
      loadGraphTypes: async () => ({}),
      loadSetPhaseCore: async () => ({ setPhaseCore }),
    },
    setPhaseCore,
    storeClose: store.close,
  };
}

describe("runSetPhase (D1)", () => {
  afterEach(() => {
    resetParentBridgeForTests();
  });

  it("calls setPhaseCore with parsed args (phase + mode + code-intel + prerequisites)", async () => {
    const { runtime, setPhaseCore } = makeRuntime();
    setParentRuntimeForTests(runtime);

    await runSetPhase({
      ...baseCtx,
      args: ["IMPLEMENT"],
      flags: { mode: "strict", "code-intel": "advisory", prerequisites: "advisory" },
    });

    expect(setPhaseCore).toHaveBeenCalledOnce();
    const call = setPhaseCore.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(call.phase).toBe("IMPLEMENT");
    expect(call.mode).toBe("strict");
    expect(call.codeIntelligence).toBe("advisory");
    expect(call.prerequisites).toBe("advisory");
  });

  it("emits JSON output when --json flag is set", async () => {
    const { runtime } = makeRuntime();
    setParentRuntimeForTests(runtime);

    const result = await runSetPhase({
      ...baseCtx,
      args: ["VALIDATE"],
      flags: { json: true },
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({
      ok: true,
      action: "override",
      phase: "IMPLEMENT",
    });
  });

  it("returns blocked result with exit 1 when setPhaseCore returns ok:false", async () => {
    const { runtime } = makeRuntime({
      result: {
        ok: false,
        kind: "phase_gate_blocked",
        error: "phase_gate_blocked: from ANALYZE to PLAN. Missing epic",
      },
    });
    setParentRuntimeForTests(runtime);

    const result = await runSetPhase({
      ...baseCtx,
      args: ["PLAN"],
      flags: {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("phase_gate_blocked");
  });

  it("rejects invalid phase value with non-zero exit and helpful error", async () => {
    const { runtime, setPhaseCore } = makeRuntime();
    setParentRuntimeForTests(runtime);

    const result = await runSetPhase({
      ...baseCtx,
      args: ["NOT_A_PHASE"],
      flags: {},
    });

    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("invalid phase");
    expect(setPhaseCore).not.toHaveBeenCalled();
  });

  it("returns usage error when phase argument is missing", async () => {
    const { runtime, setPhaseCore } = makeRuntime();
    setParentRuntimeForTests(runtime);

    const result = await runSetPhase({ ...baseCtx, args: [], flags: {} });

    expect(result.exitCode).toBe(2);
    expect(result.text).toContain("usage");
    expect(setPhaseCore).not.toHaveBeenCalled();
  });

  it("forwards force flag through to setPhaseCore", async () => {
    const { runtime, setPhaseCore } = makeRuntime();
    setParentRuntimeForTests(runtime);

    await runSetPhase({
      ...baseCtx,
      args: ["DESIGN"],
      flags: { force: true },
    });

    const call = setPhaseCore.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(call.force).toBe(true);
  });

  it("closes the store after invocation", async () => {
    const { runtime, storeClose } = makeRuntime();
    setParentRuntimeForTests(runtime);

    await runSetPhase({ ...baseCtx, args: ["IMPLEMENT"], flags: {} });

    expect(storeClose).toHaveBeenCalled();
  });
});
