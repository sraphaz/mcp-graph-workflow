/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T03 — LLM compaction tests.
 */

import { describe, it, expect } from "vitest";
import {
  llmCompact,
  recursiveCompactText,
  shouldCompact,
  totalTokens,
  COMPACT_THRESHOLD_RATIO,
  DEFAULT_MAX_RECURSION,
  type ChatMessage,
} from "../core/context/llm-summarizer.js";

const naiveCount = (s: string) => Math.ceil(s.length / 4);

describe("llm-summarizer (E7.T03)", () => {
  it("constants: threshold=0.8, maxRecursion=10", () => {
    expect(COMPACT_THRESHOLD_RATIO).toBe(0.8);
    expect(DEFAULT_MAX_RECURSION).toBe(10);
  });

  it("totalTokens sums per-message counts", () => {
    expect(
      totalTokens(
        [
          { role: "user", content: "abcd" },
          { role: "assistant", content: "efgh" },
        ],
        naiveCount,
      ),
    ).toBe(2);
  });

  it("shouldCompact: false when below threshold", () => {
    expect(
      shouldCompact(
        [{ role: "user", content: "x".repeat(100) }],
        naiveCount,
        { maxContext: 100 },
      ),
    ).toBe(false);
  });

  it("shouldCompact: true when above 80% of maxContext", () => {
    const big = "x".repeat(400); // 100 tokens
    expect(
      shouldCompact([{ role: "user", content: big }], naiveCount, { maxContext: 100 }),
    ).toBe(true);
  });

  it("recursiveCompactText returns original when within size", () => {
    const s = "small";
    expect(
      recursiveCompactText(s, async (t) => `S(${t})`, 100, 10),
    ).resolves.toBe("small");
  });

  it("recursiveCompactText halts at maxRecursion=0 returning text as-is", async () => {
    const text = "x".repeat(1000);
    const out = await recursiveCompactText(
      text,
      async () => "x".repeat(1000), // summary identical → would loop
      10,
      0,
    );
    expect(out).toBe(text);
  });

  it("recursiveCompactText shrinks text via summarize fn", async () => {
    const text = "x".repeat(8000);
    const summarize = async (chunk: string) => `[sum:${chunk.length}]`;
    const out = await recursiveCompactText(text, summarize, 1000, 5);
    expect(out.length).toBeLessThan(text.length);
  });

  it("llmCompact preserves system / user / assistant / tool-call messages", async () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "S" },
      { role: "user", content: "U" },
      { role: "assistant", content: "A" },
      { role: "tool-call", content: "TC" },
    ];
    const out = await llmCompact(msgs, async (t) => `[${t}]`, { maxContext: 100 });
    expect(out.map((m) => m.content)).toEqual(["S", "U", "A", "TC"]);
  });

  it("llmCompact summarizes tool-result content only when over chunkChars", async () => {
    const long = "x".repeat(8000);
    const msgs: ChatMessage[] = [
      { role: "user", content: "keep me" },
      { role: "tool-result", content: long },
    ];
    const summarize = async (c: string) => `[sum:${c.length}]`;
    const out = await llmCompact(msgs, summarize, {
      maxContext: 1000,
      chunkChars: 2000,
    });
    expect(out[0].content).toBe("keep me");
    expect(out[1].content.length).toBeLessThan(long.length);
    expect(out[1].content).toContain("[sum:");
  });

  it("llmCompact leaves small tool-result untouched", async () => {
    const msgs: ChatMessage[] = [
      { role: "tool-result", content: "small" },
    ];
    const out = await llmCompact(msgs, async () => "X", { maxContext: 100, chunkChars: 4000 });
    expect(out[0].content).toBe("small");
  });
});
