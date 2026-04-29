/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-1.T07 — Star topology broadcast tests.
 */

import { describe, it, expect } from "vitest";
import {
  runStarBroadcast,
  StarHubError,
  getHubId,
  getWorkers,
  buildStarRoutes,
  type SpokeHandler,
} from "../core/swarm/topologies/star.js";

describe("star topology broadcast (E1.T07)", () => {
  it("getHubId / getWorkers / buildStarRoutes invariants", () => {
    expect(getHubId(["hub", "w1", "w2"])).toBe("hub");
    expect(getWorkers(["hub", "w1", "w2"])).toEqual(["w1", "w2"]);
    expect(buildStarRoutes("hub", ["w1", "w2"])).toEqual({ w1: "hub", w2: "hub" });
  });

  it("hub broadcasts the same input to each spoke", async () => {
    const seen: string[] = [];
    const spokes: SpokeHandler<string, string>[] = [
      { agentId: "s1", reply: (x) => { seen.push(`s1:${x}`); return `s1-${x}`; } },
      { agentId: "s2", reply: (x) => { seen.push(`s2:${x}`); return `s2-${x}`; } },
      { agentId: "s3", reply: (x) => { seen.push(`s3:${x}`); return `s3-${x}`; } },
    ];
    const r = await runStarBroadcast("hub", spokes, "ping");
    expect(seen.sort()).toEqual(["s1:ping", "s2:ping", "s3:ping"]);
    const outs = r.spokes.map((s) => s.output);
    expect(outs).toEqual(["s1-ping", "s2-ping", "s3-ping"]);
  });

  it("each spoke replies individually — failure of one spoke does NOT abort others", async () => {
    const spokes: SpokeHandler<number, number>[] = [
      { agentId: "ok1", reply: (x) => x + 1 },
      {
        agentId: "broken",
        reply: () => {
          throw new Error("spoke down");
        },
      },
      { agentId: "ok2", reply: (x) => x + 2 },
    ];
    const r = await runStarBroadcast("hub", spokes, 10);
    expect(r.spokes).toHaveLength(3);
    expect(r.spokes[0]).toMatchObject({ agentId: "ok1", ok: true, output: 11 });
    expect(r.spokes[1]).toMatchObject({ agentId: "broken", ok: false });
    expect((r.spokes[1].error as Error).message).toBe("spoke down");
    expect(r.spokes[2]).toMatchObject({ agentId: "ok2", ok: true, output: 12 });
  });

  it("hub-handler exception surfaces as StarHubError (typed)", async () => {
    const spokes: SpokeHandler<string, string>[] = [
      { agentId: "s1", reply: (x) => x },
    ];
    const hubHandler = () => {
      throw new Error("hub crashed");
    };
    await expect(runStarBroadcast("hub", spokes, "ping", hubHandler)).rejects.toBeInstanceOf(
      StarHubError,
    );
  });

  it("StarHubError carries hubId and cause", async () => {
    const cause = new Error("disk full");
    const hubHandler = () => {
      throw cause;
    };
    try {
      await runStarBroadcast("the-hub", [], "x", hubHandler);
    } catch (err) {
      expect(err).toBeInstanceOf(StarHubError);
      const e = err as StarHubError;
      expect(e.hubId).toBe("the-hub");
      expect(e.cause).toBe(cause);
      expect(e.message).toContain("the-hub");
    }
  });

  it("hub-handler success rewrites payload broadcast to spokes", async () => {
    const spokes: SpokeHandler<string, string>[] = [
      { agentId: "s1", reply: (x) => `got:${x}` },
    ];
    const r = await runStarBroadcast<string, string>(
      "hub",
      spokes,
      "raw",
      (x) => `enriched-${x}`,
    );
    expect(r.spokes[0].output).toBe("got:enriched-raw");
  });
});
