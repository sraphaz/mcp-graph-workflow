/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * §EPIC-DETERMINISTIC-FIRST — Provider config loader.
 *
 * Reads `openaiCompatibleProviders` section from a model-hub config object,
 * validates each entry independently, and returns the valid subset. Single
 * bad entry never derails the rest. Warnings logged with structured context.
 *
 * PRD: docs/prd/glm-local-provider-config.md
 */

import {
  OpenAICompatibleProviderConfigSchema,
  type OpenAICompatibleProviderConfig,
} from "./openai-compatible-config.schema.js";

/** Minimal warn-shape so tests can spy without pulling the project logger. */
export interface WarnLogger {
  warn(message: string, context?: unknown): void;
}

const NULL_LOGGER: WarnLogger = {
  warn: () => {
    /* swallow */
  },
};

/**
 * Read `openaiCompatibleProviders` from a hub config object. Resilient to:
 *   - missing section / null / non-array → returns []
 *   - invalid entries → skip + warn
 *   - duplicate `name` → first-write-wins + warn
 */
export function loadOpenAICompatibleProviders(
  hubConfig: Record<string, unknown> | null | undefined,
  log: WarnLogger = NULL_LOGGER,
): OpenAICompatibleProviderConfig[] {
  if (!hubConfig || typeof hubConfig !== "object") return [];
  const section = hubConfig.openaiCompatibleProviders;
  if (!Array.isArray(section)) return [];

  const out: OpenAICompatibleProviderConfig[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < section.length; i += 1) {
    const entry = section[i];
    const parsed = OpenAICompatibleProviderConfigSchema.safeParse(entry);
    if (!parsed.success) {
      log.warn("openai-compatible-provider:invalid-entry", {
        index: i,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      continue;
    }
    if (seenNames.has(parsed.data.name)) {
      log.warn("openai-compatible-provider:duplicate-name", {
        index: i,
        name: parsed.data.name,
        action: "discard-second (first-write-wins)",
      });
      continue;
    }
    seenNames.add(parsed.data.name);
    out.push(parsed.data);
  }
  return out;
}
