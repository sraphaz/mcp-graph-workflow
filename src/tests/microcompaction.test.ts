/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T01 — microcompaction tests.
 */

import { describe, it, expect } from "vitest";
import {
  compactByTools,
  MICROCOMPACT_KEEP_RECENT,
} from "../core/context/microcompaction.js";
import type { ChatMessage } from "../core/context/llm-summarizer.js";

describe("microcompaction (E7.T01)", () => {
  it("MICROCOMPACT_KEEP_RECENT = 8", () => {
    expect(MICROCOMPACT_KEEP_RECENT).toBe(8);
  });

  it("returns input unchanged when tool-result count <= keepRecent", () => {
    const msgs: ChatMessage[] = Array.from({ length: 5 }, (_, i) => ({
      role: "tool-result",
      content: `r${i}`,
    }));
    const out = compactByTools(msgs, { keepRecent: 8 });
    expect(out).toEqual(msgs);
  });

  it("clears old tool-result messages beyond keepRecent window", () => {
    const msgs: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: "tool-result",
      content: `r${i}-${"X".repeat(100)}`,
    }));
    const out = compactByTools(msgs, { keepRecent: 4 });
    // First 8 should be cleared, last 4 preserved
    for (let i = 0; i < 8; i++) {
      expect(out[i].content).toMatch(/^Old tool result \(\d+ chars\) cleared$/);
    }
    expect(out[8].content).toBe(msgs[8].content);
    expect(out[11].content).toBe(msgs[11].content);
  });

  it("preserves non-tool-result messages verbatim", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "U" },
      { role: "tool-result", content: "old1" },
      { role: "tool-result", content: "old2" },
      { role: "tool-result", content: "old3" },
      { role: "assistant", content: "A" },
      { role: "tool-result", content: "keep" },
    ];
    const out = compactByTools(msgs, { keepRecent: 1 });
    expect(out[0].content).toBe("U");
    expect(out[4].content).toBe("A");
    expect(out[5].content).toBe("keep");
    expect(out[1].content).toMatch(/cleared/);
    expect(out[2].content).toMatch(/cleared/);
    expect(out[3].content).toMatch(/cleared/);
  });

  it("placeholder length reflects original content size", () => {
    const big = "x".repeat(1000);
    const msgs: ChatMessage[] = [
      { role: "tool-result", content: big },
      { role: "tool-result", content: "small" },
    ];
    const out = compactByTools(msgs, { keepRecent: 1 });
    expect(out[0].content).toBe("Old tool result (1000 chars) cleared");
  });

  it("is idempotent: running twice produces same result", () => {
    const msgs: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: "tool-result",
      content: `r${i}-content`,
    }));
    const once = compactByTools(msgs, { keepRecent: 3 });
    const twice = compactByTools(once, { keepRecent: 3 });
    expect(twice).toEqual(once);
  });

  it("preserves message ordering", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "U1" },
      { role: "tool-result", content: "T1" },
      { role: "user", content: "U2" },
      { role: "tool-result", content: "T2" },
      { role: "tool-result", content: "T3" },
    ];
    const out = compactByTools(msgs, { keepRecent: 1 });
    expect(out.map((m) => m.role)).toEqual([
      "user", "tool-result", "user", "tool-result", "tool-result",
    ]);
  });
});
