/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T06).
 * Tests for llm-judge scorer with prompt cache (judge fn injected; no real LLM).
 */

import { describe, it, expect } from "vitest";
import {
  llmJudgeScorer,
  createLlmJudgeCache,
  type LlmJudgeFn,
} from "../core/evals/scorers/llm-judge.js";

interface JudgeHarness {
  fn: LlmJudgeFn;
  readonly calls: number;
}

function judgeReturning(payload: unknown): JudgeHarness {
  const state = { calls: 0 };
  const fn: LlmJudgeFn = async () => {
    state.calls++;
    return JSON.stringify(payload);
  };
  return {
    fn,
    get calls() {
      return state.calls;
    },
  };
}

describe("llmJudgeScorer (E18.T06)", () => {
  it("kind = 'llm-judge'", () => {
    expect(llmJudgeScorer.kind).toBe("llm-judge");
  });

  it("passes threshold when score >= threshold", async () => {
    const j = judgeReturning({ score: 0.9, rationale: "near-equivalent" });
    const r = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "match?",
      judge: j.fn,
    });
    expect(r.score).toBe(0.9);
    expect(r.passed).toBe(true);
    expect(r.details).toContain("near-equivalent");
  });

  it("fails when score < threshold (default 0.7)", async () => {
    const j = judgeReturning({ score: 0.4, rationale: "different" });
    const r = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "match?",
      judge: j.fn,
    });
    expect(r.passed).toBe(false);
  });

  it("respects custom threshold", async () => {
    const j = judgeReturning({ score: 0.4, rationale: "ok" });
    const r = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "match?",
      judge: j.fn,
      threshold: 0.3,
    });
    expect(r.passed).toBe(true);
  });

  it("clamps score returned by judge to [0,1]", async () => {
    const high = judgeReturning({ score: 5, rationale: "ok" });
    const r1 = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "r",
      judge: high.fn,
    });
    expect(r1.score).toBe(1);

    const low = judgeReturning({ score: -2, rationale: "ok" });
    const r2 = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "r",
      judge: low.fn,
    });
    expect(r2.score).toBe(0);
  });

  it("uses prompt cache to avoid duplicate judge calls (same key)", async () => {
    const j = judgeReturning({ score: 0.8, rationale: "cached" });
    const cache = createLlmJudgeCache();

    const r1 = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "r",
      judge: j.fn,
      cache,
    });
    const r2 = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "r",
      judge: j.fn,
      cache,
    });
    expect(r1.score).toBe(0.8);
    expect(r2.score).toBe(0.8);
    expect(j.calls).toBe(1);
  });

  it("cache miss when any of (output, expected, rubric) changes", async () => {
    const j = judgeReturning({ score: 0.8, rationale: "ok" });
    const cache = createLlmJudgeCache();
    await llmJudgeScorer.score({ output: "a", expected: "b", rubric: "r", judge: j.fn, cache });
    await llmJudgeScorer.score({ output: "a", expected: "c", rubric: "r", judge: j.fn, cache });
    await llmJudgeScorer.score({ output: "a", expected: "b", rubric: "r2", judge: j.fn, cache });
    expect(j.calls).toBe(3);
  });

  it("returns score=0 + passed=false + details when judge returns invalid JSON", async () => {
    const fn: LlmJudgeFn = async () => "not json at all";
    const r = await llmJudgeScorer.score({
      output: "x",
      expected: "y",
      rubric: "r",
      judge: fn,
    });
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.details).toBeTruthy();
  });
});
