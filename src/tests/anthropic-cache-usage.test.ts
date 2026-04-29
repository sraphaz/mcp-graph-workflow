/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T02 — Anthropic cache usage extraction tests.
 */

import { describe, it, expect } from "vitest";
import { extractAnthropicUsage } from "../core/llm/adapters/anthropic-cache-usage.js";

describe("anthropic-cache-usage (E11.T02)", () => {
  it("maps input/output tokens", () => {
    const u = extractAnthropicUsage({ input_tokens: 100, output_tokens: 50 });
    expect(u.inputTokens).toBe(100);
    expect(u.outputTokens).toBe(50);
  });

  it("populates cachedTokens from cache_read_input_tokens", () => {
    const u = extractAnthropicUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 80,
    });
    expect(u.cachedTokens).toBe(80);
  });

  it("populates cacheCreationTokens from cache_creation_input_tokens", () => {
    const u = extractAnthropicUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 30,
    });
    expect(u.cacheCreationTokens).toBe(30);
  });

  it("backward compat: missing cache fields stay undefined (not 0)", () => {
    const u = extractAnthropicUsage({ input_tokens: 100, output_tokens: 50 });
    expect(u.cachedTokens).toBeUndefined();
    expect(u.cacheCreationTokens).toBeUndefined();
  });

  it("treats null cache fields as undefined", () => {
    const u = extractAnthropicUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    });
    expect(u.cachedTokens).toBeUndefined();
    expect(u.cacheCreationTokens).toBeUndefined();
  });

  it("handles undefined usage object: zeros + undefined cache", () => {
    const u = extractAnthropicUsage(undefined);
    expect(u.inputTokens).toBe(0);
    expect(u.outputTokens).toBe(0);
    expect(u.cachedTokens).toBeUndefined();
  });

  it("rejects negative values as undefined (defensive)", () => {
    const u = extractAnthropicUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: -1,
    });
    expect(u.cachedTokens).toBeUndefined();
  });

  it("rejects non-finite (Infinity/NaN) as undefined", () => {
    const u = extractAnthropicUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: Number.NaN,
    });
    expect(u.cachedTokens).toBeUndefined();
  });

  it("zero cache values are preserved (provider reported 0 reads)", () => {
    const u = extractAnthropicUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 0,
    });
    expect(u.cachedTokens).toBe(0);
  });
});
