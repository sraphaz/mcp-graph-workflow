/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-1.T06 — Ring pipeline runner tests.
 */

import { describe, it, expect } from "vitest";
import {
  runRingPipeline,
  getRingOrder,
  buildRingRoutes,
  type RingStage,
} from "../core/swarm/topologies/ring.js";

describe("ring topology runner (E1.T06)", () => {
  it("preserves stage order: getRingOrder produces A→B→C→A", () => {
    const order = getRingOrder(["A", "B", "C"]);
    expect(order).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "A" },
    ]);
  });

  it("buildRingRoutes maps each agent to its successor", () => {
    expect(buildRingRoutes(["A", "B", "C"])).toEqual({ A: "B", B: "C", C: "A" });
  });

  it("3-stage ring pipeline completes with composed output", async () => {
    const stages: RingStage<number>[] = [
      { agentId: "double", run: (x) => x * 2 },
      { agentId: "plus3", run: (x) => x + 3 },
      { agentId: "negate", run: (x) => -x },
    ];
    const r = await runRingPipeline(stages, 5);
    expect(r.ok).toBe(true);
    expect(r.output).toBe(-(5 * 2 + 3));
    expect(r.completed).toEqual(["double", "plus3", "negate"]);
  });

  it("failure isolates to the failing stage — subsequent stages are not invoked", async () => {
    let stage3Calls = 0;
    const stages: RingStage<number>[] = [
      { agentId: "ok", run: (x) => x + 1 },
      {
        agentId: "boom",
        run: () => {
          throw new Error("kaboom");
        },
      },
      {
        agentId: "never",
        run: (x) => {
          stage3Calls++;
          return x;
        },
      },
    ];
    const r = await runRingPipeline(stages, 0);
    expect(r.ok).toBe(false);
    expect(r.failedAt).toBe("boom");
    expect(r.failedAtIndex).toBe(1);
    expect((r.error as Error).message).toBe("kaboom");
    expect(r.completed).toEqual(["ok"]);
    expect(stage3Calls).toBe(0);
  });

  it("empty stages list completes immediately with the initial value", async () => {
    const r = await runRingPipeline<number>([], 42);
    expect(r.ok).toBe(true);
    expect(r.output).toBe(42);
    expect(r.completed).toEqual([]);
  });

  it("works with async stages (Promise return)", async () => {
    const stages: RingStage<string>[] = [
      { agentId: "upper", run: async (s) => s.toUpperCase() },
      { agentId: "exclaim", run: async (s) => `${s}!` },
    ];
    const r = await runRingPipeline(stages, "hello");
    expect(r.output).toBe("HELLO!");
  });
});
