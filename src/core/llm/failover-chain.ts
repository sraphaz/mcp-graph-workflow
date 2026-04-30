/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-16 LLM Failover — parses the LLM_FAILOVER_CHAIN env var into a
 * typed list of provider/model pairs the gateway can iterate when the
 * primary fails (or its circuit breaker is open).
 */

export interface FailoverEntry {
  provider: string;
  model: string;
}

export function parseFailoverChain(raw: string | undefined): FailoverEntry[] {
  if (!raw) return [];
  const out: FailoverEntry[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const provider = trimmed.slice(0, idx).trim();
    const model = trimmed.slice(idx + 1).trim();
    if (!provider || !model) continue;
    out.push({ provider, model });
  }
  return out;
}

/**
 * §extracta-completion — sensible default fallback chain. Emits cheap
 * Anthropic + OpenAI mid-tier models so a freshly-initialized gateway
 * has SOMETHING to fall back to when the soft-cap trips. Callers can
 * still override entirely via LLM_FAILOVER_CHAIN env var.
 */
export function defaultFailoverChain(): FailoverEntry[] {
  return [
    { provider: "anthropic", model: "anthropic/claude-haiku-4-5" },
    { provider: "openai", model: "openai/gpt-4o-mini" },
  ];
}

/**
 * §extracta-completion — resolve the chain to use at gateway construction:
 * env var if provided, otherwise the default. Returns [] only when the
 * caller explicitly sets LLM_FAILOVER_CHAIN="" (opt-out).
 */
export function resolveFailoverChain(env: NodeJS.ProcessEnv = process.env): FailoverEntry[] {
  const raw = env.LLM_FAILOVER_CHAIN;
  if (raw === undefined) return defaultFailoverChain();
  if (raw.trim() === "") return [];
  return parseFailoverChain(raw);
}
