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
