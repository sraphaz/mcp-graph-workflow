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
 * Unit tests for runLifecycleFacade — the core orchestrator that fans out
 * analyze() modes for a given lifecycle phase and aggregates outputs.
 *
 * Validates:
 * - returns one entry per mode in getModesForPhase(phase)
 * - aggregates successful payloads under `outputs`
 * - tracks failures under `errors` and emits `mode_failed` warnings
 * - emits `no_modes_for_phase` when phase has no mapped modes
 * - subCheck filters to a single mode when provided
 */

import { describe, it, expect } from "vitest";
import { runLifecycleFacade, type ModeInvoker } from "../core/planner/lifecycle-facade.js";
import { getModesForPhase } from "../core/planner/lifecycle-phase.js";

function ok(payload: Record<string, unknown>): ReturnType<ModeInvoker> {
  return Promise.resolve({ ok: true as const, payload });
}

function err(message: string): ReturnType<ModeInvoker> {
  return Promise.resolve({ ok: false as const, error: message });
}

describe("runLifecycleFacade", () => {
  it("AC1 — returns one entry per mode in getModesForPhase(phase)", async () => {
    const invokeMode: ModeInvoker = (mode) => ok({ mode, sample: `data-for-${mode}` });
    const expectedModes = getModesForPhase("DESIGN");

    const report = await runLifecycleFacade(invokeMode, "DESIGN");

    expect(report.phase).toBe("DESIGN");
    expect(report.modes).toEqual(expectedModes);
    expect(Object.keys(report.outputs).sort()).toEqual([...expectedModes].sort());
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual({});
  });

  it("aggregates payloads keyed by mode name under `outputs`", async () => {
    const invokeMode: ModeInvoker = (mode) => ok({ mode, ok: true, value: 42, marker: `m-${mode}` });

    const report = await runLifecycleFacade(invokeMode, "DESIGN");

    for (const mode of report.modes) {
      const out = report.outputs[mode] as Record<string, unknown>;
      expect(out).toBeDefined();
      // Redundant `ok` and `mode` fields are stripped — they're implicit
      // (success because the entry exists; mode because it's already the key).
      expect(out.ok).toBeUndefined();
      expect(out.mode).toBeUndefined();
      // Other payload fields are preserved
      expect(out.value).toBe(42);
      expect(out.marker).toBe(`m-${mode}`);
    }
  });

  it("tracks failures under `errors` and emits mode_failed warnings", async () => {
    const failingMode = getModesForPhase("DESIGN")[0];
    const invokeMode: ModeInvoker = (mode) =>
      mode === failingMode ? err("boom") : ok({ mode });

    const report = await runLifecycleFacade(invokeMode, "DESIGN");

    expect(report.ok).toBe(false);
    expect(report.errors[failingMode]).toBe("boom");
    expect(report.warnings.some((w) => w.code === "mode_failed" && w.mode === failingMode)).toBe(true);
    expect(report.outputs[failingMode]).toBeUndefined();

    // Other modes still succeed
    for (const mode of report.modes) {
      if (mode === failingMode) continue;
      expect(report.outputs[mode]).toBeDefined();
    }
  });

  it("emits no_modes_for_phase warning when phase has no modes mapped", async () => {
    const invokeMode: ModeInvoker = (mode) => ok({ mode });

    const report = await runLifecycleFacade(invokeMode, "UNKNOWN_PHASE" as never);

    expect(report.modes).toEqual([]);
    expect(report.warnings.some((w) => w.code === "no_modes_for_phase")).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.outputs).toEqual({});
  });

  it("subCheck filters to the single named mode when valid", async () => {
    const designModes = getModesForPhase("DESIGN");
    const target = designModes[1];
    const calledModes: string[] = [];
    const invokeMode: ModeInvoker = (mode) => {
      calledModes.push(mode);
      return ok({ mode });
    };

    const report = await runLifecycleFacade(invokeMode, "DESIGN", target);

    expect(calledModes).toEqual([target]);
    expect(report.modes).toEqual([target]);
    expect(report.outputs[target]).toBeDefined();
  });

  it("subCheck mismatch emits mode_unknown warning and runs nothing", async () => {
    const calledModes: string[] = [];
    const invokeMode: ModeInvoker = (mode) => {
      calledModes.push(mode);
      return ok({ mode });
    };

    const report = await runLifecycleFacade(invokeMode, "DESIGN", "not_a_real_mode");

    expect(calledModes).toEqual([]);
    expect(report.modes).toEqual([]);
    expect(report.warnings.some((w) => w.code === "mode_unknown")).toBe(true);
  });

  it("runs modes in parallel via Promise.all (start ordering preserved)", async () => {
    const startOrder: string[] = [];
    const invokeMode: ModeInvoker = async (mode: string) => {
      startOrder.push(mode);
      // tiny delay so all start before any finish — proves parallelism
      await new Promise((r) => setTimeout(r, 1));
      return { ok: true as const, payload: { mode } };
    };

    const report = await runLifecycleFacade(invokeMode, "DESIGN");
    const expectedModes = getModesForPhase("DESIGN");

    // All modes should have been entered before any completed
    expect(startOrder.length).toBe(expectedModes.length);
    expect(new Set(startOrder)).toEqual(new Set(expectedModes));
    expect(Object.keys(report.outputs).length).toBe(expectedModes.length);
  });
});
