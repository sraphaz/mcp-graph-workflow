/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T06 — compaction pipeline tests.
 */

import { describe, it, expect } from "vitest";
import {
  compactionPipeline,
  microCompact,
  spilloverCompact,
  emergencyTruncate,
} from "../core/context/compaction-pipeline.js";
import type { ChatMessage } from "../core/context/llm-summarizer.js";

const charCount = (s: string) => s.length;

describe("compaction-pipeline (E7.T06)", () => {
  describe("microCompact", () => {
    it("drops adjacent duplicate tool-result messages", () => {
      const r = microCompact([
        { role: "tool-result", content: "X" },
        { role: "tool-result", content: "X" },
        { role: "tool-result", content: "Y" },
      ]);
      expect(r).toHaveLength(2);
    });

    it("does NOT collapse non-tool-result duplicates", () => {
      const r = microCompact([
        { role: "user", content: "hi" },
        { role: "user", content: "hi" },
      ]);
      expect(r).toHaveLength(2);
    });
  });

  describe("spilloverCompact", () => {
    it("folds older messages into single summary line, preserving last N", () => {
      const msgs: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: "user",
        content: `m${i}`,
      }));
      const out = spilloverCompact(msgs, 3);
      expect(out).toHaveLength(4);
      expect(out[0].role).toBe("system");
      expect(out[0].content).toContain("spillover-summary");
      expect(out.slice(1).map((m) => m.content)).toEqual(["m7", "m8", "m9"]);
    });

    it("returns input unchanged when length <= keepRecent", () => {
      const msgs: ChatMessage[] = [{ role: "user", content: "x" }];
      expect(spilloverCompact(msgs, 4)).toEqual(msgs);
    });
  });

  describe("emergencyTruncate", () => {
    it("keeps only last N messages with truncation marker", () => {
      const msgs: ChatMessage[] = Array.from({ length: 8 }, (_, i) => ({
        role: "user",
        content: `m${i}`,
      }));
      const out = emergencyTruncate(msgs, 3);
      expect(out).toHaveLength(4);
      expect(out[0].content).toContain("emergency-truncate");
      expect(out.slice(1).map((m) => m.content)).toEqual(["m5", "m6", "m7"]);
    });

    it("returns input unchanged when length <= keepLast", () => {
      const msgs: ChatMessage[] = [{ role: "user", content: "x" }];
      expect(emergencyTruncate(msgs, 4)).toEqual(msgs);
    });
  });

  describe("compactionPipeline", () => {
    it("levelUsed='none' when already under target", () => {
      const msgs: ChatMessage[] = [{ role: "user", content: "small" }];
      return compactionPipeline(msgs, {
        maxContext: 1000,
        counter: charCount,
        summarize: async (s) => s,
      }).then((r) => {
        expect(r.metrics.levelUsed).toBe("none");
        expect(r.metrics.tokensAfter).toBe(r.metrics.tokensBefore);
      });
    });

    it("uses micro level when adjacent duplicates fit target", async () => {
      const big = "x".repeat(700);
      const msgs: ChatMessage[] = [
        { role: "user", content: big },
        { role: "tool-result", content: big },
        { role: "tool-result", content: big },
      ];
      const r = await compactionPipeline(msgs, {
        maxContext: 1500,
        targetRatio: 1,
        counter: charCount,
        summarize: async (s) => s,
      });
      expect(r.metrics.levelUsed).toBe("micro");
      expect(r.metrics.tokensAfter).toBeLessThan(r.metrics.tokensBefore);
    });

    it("escalates through levels until target is met", async () => {
      const msgs: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        role: "tool-result",
        content: `${i}-${"y".repeat(200)}`, // unique → micro can't dedupe
      }));
      const r = await compactionPipeline(msgs, {
        maxContext: 800,
        targetRatio: 0.5,
        counter: charCount,
        summarize: async () => "[sum]",
      });
      expect(["spillover", "llm", "emergency"]).toContain(r.metrics.levelUsed);
      expect(r.metrics.tokensAfter).toBeLessThan(r.metrics.tokensBefore);
      expect(r.metrics.levelsTried.length).toBeGreaterThanOrEqual(1);
    });

    it("emergency level triggers when nothing else fits", async () => {
      const msgs: ChatMessage[] = Array.from({ length: 30 }, () => ({
        role: "user" as const,
        content: "z".repeat(500),
      }));
      const r = await compactionPipeline(msgs, {
        maxContext: 100,
        counter: charCount,
        summarize: async (s) => s,
        emergencyKeepLast: 2,
      });
      expect(r.metrics.levelUsed).toBe("emergency");
      expect(r.messages.length).toBeLessThanOrEqual(3);
    });

    it("metrics include tokensBefore/tokensAfter/durationMs/levelsTried", async () => {
      const msgs: ChatMessage[] = [{ role: "user", content: "x" }];
      const r = await compactionPipeline(msgs, {
        maxContext: 100,
        counter: charCount,
        summarize: async (s) => s,
      });
      expect(r.metrics).toHaveProperty("tokensBefore");
      expect(r.metrics).toHaveProperty("tokensAfter");
      expect(r.metrics).toHaveProperty("durationMs");
      expect(Array.isArray(r.metrics.levelsTried)).toBe(true);
    });
  });
});
