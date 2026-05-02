/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T02 — Anthropic prompt-cache usage extractor.
 * Pure: maps response.usage.{cache_creation_input_tokens, cache_read_input_tokens}
 * into our LlmUsage shape. Missing fields stay undefined (not 0) so callers
 * can distinguish "no cache used" from "provider didn't report".
 */

export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
}

function asPositiveOrUndefined(n: number | null | undefined): number | undefined {
  if (n === null || n === undefined) return undefined;
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** extractAnthropicUsage — auto-generated description placeholder. */
export function extractAnthropicUsage(usage: AnthropicUsage | null | undefined): LlmUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cachedTokens: asPositiveOrUndefined(usage?.cache_read_input_tokens),
    cacheCreationTokens: asPositiveOrUndefined(usage?.cache_creation_input_tokens),
  };
}
