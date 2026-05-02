/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T05 — Anthropic dynamic cache_control headers.
 * Pure: builds the `system` array sent to Anthropic with a cache_control
 * breakpoint on the stable prefix and an optional dynamic suffix appended
 * AFTER the breakpoint so per-turn variation never invalidates the cache.
 *
 * Toggle via env ANTHROPIC_CACHE_ENABLED. Default ON; set to "false" to
 * skip injection (e.g., when debugging cache behaviour).
 */

export interface AnthropicTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export interface BuildSystemPromptOptions {
  systemPrompt: string;
  /** Optional dynamic suffix appended after the cache breakpoint. */
  dynamicSuffix?: string;
  env?: NodeJS.ProcessEnv;
}

/** isAnthropicCacheEnabled — auto-generated description placeholder. */
export function isAnthropicCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ANTHROPIC_CACHE_ENABLED !== "false";
}

/**
 * Returns the system content array. When cache is enabled and the prompt is
 * non-empty, the first text block carries `cache_control: { type: 'ephemeral' }`
 * — keeping subsequent calls warm. Dynamic suffix (if present) is a separate,
 * uncached block AFTER it so changes don't invalidate the prefix.
 */
export function buildSystemBlocks(opts: BuildSystemPromptOptions): AnthropicTextBlock[] {
  const enabled = isAnthropicCacheEnabled(opts.env);
  const blocks: AnthropicTextBlock[] = [];
  const prompt = (opts.systemPrompt ?? "").trim();
  if (prompt) {
    const block: AnthropicTextBlock = { type: "text", text: prompt };
    if (enabled) block.cache_control = { type: "ephemeral" };
    blocks.push(block);
  }
  const suffix = opts.dynamicSuffix?.trim();
  if (suffix) {
    blocks.push({ type: "text", text: suffix });
  }
  return blocks;
}
