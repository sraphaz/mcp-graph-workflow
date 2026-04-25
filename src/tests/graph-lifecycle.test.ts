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
import { buildGraphLifecycleResponse, type AnalyzeRunner } from "../mcp/tools/graph-lifecycle.js";
import type { AnalyzeMode } from "../core/planner/lifecycle-phase.js";

const okRunner: AnalyzeRunner = async (mode: AnalyzeMode) => ({
  ok: true,
  mode,
  payload: { score: 100 },
});

const errRunner: AnalyzeRunner = async (mode: AnalyzeMode) => {
  if (mode === "tech_risk") throw new Error("tech_risk failed");
  return { ok: true, mode };
};

describe("graph_lifecycle wrapper — V11 Maestro Phase 3", () => {
  it("runs every mode for a phase and aggregates results", async () => {
    const r = await buildGraphLifecycleResponse("DESIGN", okRunner);
    expect(r.ok).toBe(true);
    expect(r.phase).toBe("DESIGN");
    expect(r.results.length).toBe(7);
    const modes = r.results.map((x) => x.mode).sort();
    expect(modes).toEqual([
      "adr", "adr_challenge", "coupling", "design_ready", "interfaces", "tech_risk", "traceability",
    ]);
    for (const result of r.results) {
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it("uses Promise.allSettled — one mode failing does NOT abort the wrapper", async () => {
    const r = await buildGraphLifecycleResponse("DESIGN", errRunner);
    expect(r.ok).toBe(true); // wrapper itself succeeded
    expect(r.results.length).toBe(7);
    const failed = r.results.find((x) => x.mode === "tech_risk")!;
    expect(failed.ok).toBe(false);
    expect(failed.error).toMatch(/tech_risk failed/);
    const others = r.results.filter((x) => x.mode !== "tech_risk");
    for (const x of others) expect(x.ok).toBe(true);
  });

  it("returns durationMs covering the slowest mode (parallel exec)", async () => {
    const slowRunner: AnalyzeRunner = async (mode) => {
      // adr is "slow" — 30ms; others are fast (5ms)
      const ms = mode === "adr" ? 30 : 5;
      await new Promise((res) => setTimeout(res, ms));
      return { ok: true, mode };
    };

    const t0 = Date.now();
    const r = await buildGraphLifecycleResponse("DESIGN", slowRunner);
    const elapsed = Date.now() - t0;

    expect(r.ok).toBe(true);
    // If parallel: total ≈ max (≈30ms). If sequential: ≈30 + 6*5 = 60ms.
    // Allow generous slack for CI noise.
    expect(elapsed).toBeLessThan(80);
    expect(r.durationMs).toBeGreaterThanOrEqual(20);
  });

  it("supports subCheck restriction (run only the named mode if it belongs to the phase)", async () => {
    const r = await buildGraphLifecycleResponse("DESIGN", okRunner, { subCheck: "adr" });
    expect(r.ok).toBe(true);
    expect(r.results.length).toBe(1);
    expect(r.results[0].mode).toBe("adr");
  });

  it("returns ok=false when subCheck is not part of the phase", async () => {
    const r = await buildGraphLifecycleResponse("DESIGN", okRunner, { subCheck: "tdd_check" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not.*phase|tdd_check/i);
  });

  it("returns ok=false for an unknown phase (no throw)", async () => {
    type LP = Parameters<typeof buildGraphLifecycleResponse>[0];
    const r = await buildGraphLifecycleResponse("WONK" as LP, okRunner);
    expect(r.ok).toBe(false);
  });

  it("returns at-most-N results when N modes are in the phase (HANDOFF=2)", async () => {
    const r = await buildGraphLifecycleResponse("HANDOFF", okRunner);
    expect(r.ok).toBe(true);
    expect(r.results.length).toBe(2);
  });
});
