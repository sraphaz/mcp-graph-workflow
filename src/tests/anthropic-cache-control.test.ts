/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T05 — Anthropic cache_control header tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildSystemBlocks,
  isAnthropicCacheEnabled,
} from "../core/llm/adapters/anthropic-cache-control.js";

describe("anthropic-cache-control (E11.T05)", () => {
  it("default cache enabled when env unset", () => {
    expect(isAnthropicCacheEnabled({})).toBe(true);
  });

  it("disables when ANTHROPIC_CACHE_ENABLED='false'", () => {
    expect(isAnthropicCacheEnabled({ ANTHROPIC_CACHE_ENABLED: "false" })).toBe(false);
    expect(isAnthropicCacheEnabled({ ANTHROPIC_CACHE_ENABLED: "true" })).toBe(true);
  });

  it("returns single block with cache_control on prompt when no suffix", () => {
    const blocks = buildSystemBlocks({ systemPrompt: "You are mcp-graph." });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].text).toBe("You are mcp-graph.");
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("appends dynamic suffix as separate uncached block AFTER the breakpoint", () => {
    const blocks = buildSystemBlocks({
      systemPrompt: "stable prefix",
      dynamicSuffix: "turn-specific facts",
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1].cache_control).toBeUndefined();
    expect(blocks[1].text).toBe("turn-specific facts");
  });

  it("omits cache_control when env disables", () => {
    const blocks = buildSystemBlocks({
      systemPrompt: "x",
      env: { ANTHROPIC_CACHE_ENABLED: "false" } as NodeJS.ProcessEnv,
    });
    expect(blocks[0].cache_control).toBeUndefined();
  });

  it("returns empty array when prompt is blank", () => {
    expect(buildSystemBlocks({ systemPrompt: "" })).toEqual([]);
    expect(buildSystemBlocks({ systemPrompt: "   " })).toEqual([]);
  });

  it("ignores whitespace-only dynamic suffix", () => {
    const blocks = buildSystemBlocks({ systemPrompt: "p", dynamicSuffix: "  \n  " });
    expect(blocks).toHaveLength(1);
  });

  it("dynamic suffix without main prompt: emits suffix only (no cache_control)", () => {
    const blocks = buildSystemBlocks({ systemPrompt: "", dynamicSuffix: "only suffix" });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].cache_control).toBeUndefined();
    expect(blocks[0].text).toBe("only suffix");
  });
});
