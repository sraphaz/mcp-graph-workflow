/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildEconomyPipeline, ECONOMY_PIPELINE_ORDER } from "../core/economy/economy-pipeline.js";

type FakeRequest = { prompt: string; model?: string };
type FakeResponse = { text: string; fromStage?: string };

describe("economy-pipeline order", () => {
  it("exports the canonical stage order (Booster→Cache→Tier→Batch→Tiered→LLM)", () => {
    expect(ECONOMY_PIPELINE_ORDER).toEqual(["booster", "cache", "tier", "batch", "tiered", "llm"]);
  });
});

describe("buildEconomyPipeline", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ECONOMY_BOOSTER;
    delete process.env.ECONOMY_CACHE;
    delete process.env.ECONOMY_TIER_ROUTER;
    delete process.env.ECONOMY_BATCH;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("with all flags off, calls llmFn directly and returns its result", async () => {
    const llmFn = async (_req: FakeRequest) => ({ text: "llm-response" });
    const pipeline = buildEconomyPipeline<FakeRequest, FakeResponse>({ llmFn });
    const result = await pipeline({ prompt: "hello" });
    expect(result.text).toBe("llm-response");
  });

  it("with all flags off, no stage interceptor is invoked", async () => {
    const intercepted: string[] = [];
    const llmFn = async (_req: FakeRequest) => ({ text: "direct" });
    const pipeline = buildEconomyPipeline<FakeRequest, FakeResponse>({
      llmFn,
      stages: {
        booster: async (_req, next) => { intercepted.push("booster"); return next(_req); },
        cache: async (_req, next) => { intercepted.push("cache"); return next(_req); },
      },
    });
    await pipeline({ prompt: "test" });
    expect(intercepted).toHaveLength(0);
  });

  it("with ECONOMY_CACHE=on, cache stage is invoked before LLM", async () => {
    process.env.ECONOMY_CACHE = "on";
    const order: string[] = [];
    const llmFn = async (_req: FakeRequest) => { order.push("llm"); return { text: "r" }; };
    const pipeline = buildEconomyPipeline<FakeRequest, FakeResponse>({
      llmFn,
      stages: {
        cache: async (req, next) => { order.push("cache"); return next(req); },
      },
    });
    await pipeline({ prompt: "test" });
    expect(order).toEqual(["cache", "llm"]);
  });

  it("with ECONOMY_BOOSTER=on and cache=on, booster runs before cache", async () => {
    process.env.ECONOMY_BOOSTER = "on";
    process.env.ECONOMY_CACHE = "on";
    const order: string[] = [];
    const llmFn = async (_req: FakeRequest) => { order.push("llm"); return { text: "r" }; };
    const pipeline = buildEconomyPipeline<FakeRequest, FakeResponse>({
      llmFn,
      stages: {
        booster: async (req, next) => { order.push("booster"); return next(req); },
        cache: async (req, next) => { order.push("cache"); return next(req); },
      },
    });
    await pipeline({ prompt: "test" });
    expect(order).toEqual(["booster", "cache", "llm"]);
  });

  it("a stage can short-circuit and return without calling llm", async () => {
    process.env.ECONOMY_CACHE = "on";
    let llmCalled = false;
    const llmFn = async (_req: FakeRequest) => { llmCalled = true; return { text: "llm" }; };
    const pipeline = buildEconomyPipeline<FakeRequest, FakeResponse>({
      llmFn,
      stages: {
        cache: async (_req, _next) => ({ text: "cached", fromStage: "cache" }),
      },
    });
    const result = await pipeline({ prompt: "test" });
    expect(result.fromStage).toBe("cache");
    expect(llmCalled).toBe(false);
  });
});
