/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T03).
 * Tests for sequential pipeline (Red→Green→Refactor handoff).
 */

import { describe, it, expect } from "vitest";
import {
  buildPipelineStages,
  getNextStage,
  runPipeline,
  type StageExecutor,
} from "../core/swarm/topologies/pipeline.js";

describe("ring sequential pipeline (E19.T03)", () => {
  it("buildPipelineStages preserves order and links from→to (linear, no wrap)", () => {
    const stages = buildPipelineStages([
      { role: "red", agentId: "w1" },
      { role: "green", agentId: "w2" },
      { role: "refactor", agentId: "w3" },
    ]);
    expect(stages.length).toBe(3);
    expect(stages[0]?.next).toBe("w2");
    expect(stages[1]?.next).toBe("w3");
    expect(stages[2]?.next).toBeNull(); // last stage does NOT wrap
  });

  it("buildPipelineStages with single agent has next=null", () => {
    const stages = buildPipelineStages([{ role: "solo", agentId: "w" }]);
    expect(stages.length).toBe(1);
    expect(stages[0]?.next).toBeNull();
  });

  it("buildPipelineStages with empty input returns empty array", () => {
    expect(buildPipelineStages([])).toEqual([]);
  });

  it("buildPipelineStages rejects duplicate agent ids", () => {
    expect(() =>
      buildPipelineStages([
        { role: "red", agentId: "w" },
        { role: "green", agentId: "w" },
      ]),
    ).toThrow();
  });

  it("getNextStage returns next stage by current agent id", () => {
    const stages = buildPipelineStages([
      { role: "red", agentId: "a" },
      { role: "green", agentId: "b" },
      { role: "refactor", agentId: "c" },
    ]);
    expect(getNextStage(stages, "a")?.agentId).toBe("b");
    expect(getNextStage(stages, "b")?.agentId).toBe("c");
    expect(getNextStage(stages, "c")).toBeNull();
    expect(getNextStage(stages, "missing")).toBeNull();
  });

  it("runPipeline threads output of stage N as input to stage N+1", async () => {
    const stages = buildPipelineStages([
      { role: "red", agentId: "a" },
      { role: "green", agentId: "b" },
      { role: "refactor", agentId: "c" },
    ]);

    const seen: Array<{ agent: string; input: string }> = [];
    const executor: StageExecutor<string> = async (stage, input) => {
      seen.push({ agent: stage.agentId, input });
      return `${input}->${stage.agentId}`;
    };

    const result = await runPipeline(stages, "seed", executor);
    expect(result).toBe("seed->a->b->c");
    expect(seen).toEqual([
      { agent: "a", input: "seed" },
      { agent: "b", input: "seed->a" },
      { agent: "c", input: "seed->a->b" },
    ]);
  });

  it("runPipeline returns input unchanged when no stages", async () => {
    const executor: StageExecutor<string> = async () => "should-not-run";
    const result = await runPipeline<string>([], "seed", executor);
    expect(result).toBe("seed");
  });

  it("runPipeline halts on executor throw and propagates the error", async () => {
    const stages = buildPipelineStages([
      { role: "red", agentId: "a" },
      { role: "green", agentId: "b" },
    ]);
    const executor: StageExecutor<string> = async (stage) => {
      if (stage.agentId === "b") throw new Error("green failed");
      return "ok";
    };
    await expect(runPipeline(stages, "x", executor)).rejects.toThrow(/green failed/);
  });
});
