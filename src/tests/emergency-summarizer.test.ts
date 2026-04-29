/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T04 — emergency summarizer tests.
 */

import { describe, it, expect } from "vitest";
import {
  emergencyCompact,
  emergencySummarize,
} from "../core/context/emergency-summarizer.js";
import type { ChatMessage } from "../core/context/llm-summarizer.js";

describe("emergency-summarizer (E7.T04)", () => {
  it("emergencySummarize extracts markdown headings", () => {
    const text = "# H1\n\nBody.\n\n## H2\n\nMore body.";
    const out = emergencySummarize(text);
    expect(out).toContain("# H1");
    expect(out).toContain("## H2");
  });

  it("emergencySummarize extracts first sentence of each paragraph", () => {
    const text = "First sentence here. Second one ignored.\n\nAnother first. Plus filler.";
    const out = emergencySummarize(text);
    expect(out).toContain("First sentence here.");
    expect(out).toContain("Another first.");
    expect(out).not.toContain("Second one ignored");
  });

  it("emergencySummarize falls back to first 200 chars when no sentence terminator", () => {
    const text = "x".repeat(500);
    const out = emergencySummarize(text);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it("emergencySummarize returns '' on empty input", () => {
    expect(emergencySummarize("")).toBe("");
  });

  it("emergencyCompact summarizes tool-result content only", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "S" },
      { role: "user", content: "U" },
      { role: "tool-result", content: "Long sentence one. Filler ignored." },
    ];
    const out = emergencyCompact(msgs);
    expect(out[0].content).toBe("S");
    expect(out[1].content).toBe("U");
    expect(out[2].content).toContain("Long sentence one.");
    expect(out[2].content).not.toContain("Filler ignored");
  });

  it("emergencyCompact preserves message order and roles", () => {
    const msgs: ChatMessage[] = [
      { role: "tool-call", content: "TC" },
      { role: "tool-result", content: "Done." },
      { role: "assistant", content: "A" },
    ];
    const out = emergencyCompact(msgs);
    expect(out.map((m) => m.role)).toEqual(["tool-call", "tool-result", "assistant"]);
  });

  it("performance: 1000 messages compact under 100ms", () => {
    const msgs: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
      role: "tool-result",
      content: `Result ${i}. Some filler text.`,
    }));
    const start = Date.now();
    const out = emergencyCompact(msgs);
    const elapsed = Date.now() - start;
    expect(out).toHaveLength(1000);
    expect(elapsed).toBeLessThan(100);
  });
});
