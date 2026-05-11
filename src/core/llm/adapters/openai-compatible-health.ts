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
 * §EPIC-DETERMINISTIC-FIRST — Health probe + auto-discovery.
 *
 * GET <baseUrl><healthEndpoint> and parse OpenAI-shape `{ data: [{ id }] }`.
 * Reconciles declared `config.models` with what the server reports — declared
 * model not returned ⇒ structured warn so operator knows it isn't loaded.
 *
 * PRD: docs/prd/glm-local-provider-config.md (Task 2.2)
 */

import type { OpenAICompatibleProviderConfig } from "./openai-compatible-config.schema.js";

export interface ProbeResult {
  connected: boolean;
  modelsAvailable: string[];
  latencyMs: number;
}

export interface ProbeOptions {
  fetchImpl?: typeof fetch;
  logger?: { warn: (msg: string, ctx?: unknown) => void };
}

const NULL_LOGGER = { warn: () => undefined };

interface ModelsBody {
  data?: Array<{ id?: string }>;
}

function joinUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:/i.test(endpoint)) return endpoint;
  if (baseUrl.endsWith("/") && endpoint.startsWith("/")) {
    return baseUrl + endpoint.slice(1);
  }
  if (!baseUrl.endsWith("/") && !endpoint.startsWith("/")) {
    return baseUrl + "/" + endpoint;
  }
  return baseUrl + endpoint;
}

export async function probeHealth(
  config: OpenAICompatibleProviderConfig,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const log = options.logger ?? NULL_LOGGER;
  const url = joinUrl(config.baseUrl, config.healthEndpoint);
  const headers: Record<string, string> = {};
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  const start = performance.now();
  let body: ModelsBody | null = null;
  let connected = false;
  try {
    const response = await fetchImpl(url, { method: "GET", headers });
    if (!response.ok) {
      log.warn("openai-compatible-health:non-ok", {
        provider: config.name,
        baseUrl: config.baseUrl,
        status: response.status,
      });
    } else {
      const text = await response.text();
      try {
        body = JSON.parse(text) as ModelsBody;
        connected = Array.isArray(body.data);
      } catch {
        log.warn("openai-compatible-health:malformed-body", {
          provider: config.name,
          baseUrl: config.baseUrl,
          snippet: text.slice(0, 100),
        });
      }
    }
  } catch (cause) {
    log.warn("openai-compatible-health:transport", {
      provider: config.name,
      baseUrl: config.baseUrl,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }

  const latencyMs = performance.now() - start;
  const modelsAvailable = connected && body?.data
    ? body.data
        .map((m) => (typeof m.id === "string" ? m.id : null))
        .filter((id): id is string => id !== null)
    : [];

  // Reconcile declared vs available
  if (connected) {
    const available = new Set(modelsAvailable);
    const missing = config.models.filter((m) => !available.has(m));
    if (missing.length > 0) {
      log.warn("openai-compatible-health:declared-models-missing", {
        provider: config.name,
        missing,
        hint: "model possivelmente não-carregado no servidor",
      });
    }
  }

  return { connected, modelsAvailable, latencyMs };
}
