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
 * §EPIC-DETERMINISTIC-FIRST — Provider adapter registry.
 *
 * Maps custom provider slugs (e.g. "glm-local") to instantiated adapters.
 * Distinct from `ModelRegistry` which tracks ModelSpecs. This one tracks
 * runtime instances + supports `model: "<id>@<provider>"` suffix routing.
 *
 * PRD: docs/prd/glm-local-provider-config.md (Task 2.3)
 */

import { OperationError } from "../utils/errors.js";
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleAdapterOptions,
} from "./adapters/openai-compatible.js";
import type { OpenAICompatibleProviderConfig } from "./adapters/openai-compatible-config.schema.js";

export class DuplicateProviderError extends OperationError {
  constructor(providerId: string) {
    super(`provider already registered: ${providerId}`);
    this.name = "DuplicateProviderError";
  }
}

export class ProviderAdapterRegistry {
  private readonly adapters = new Map<string, OpenAICompatibleAdapter>();

  register(adapter: OpenAICompatibleAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      throw new DuplicateProviderError(adapter.providerId);
    }
    this.adapters.set(adapter.providerId, adapter);
  }

  getProvider(providerId: string): OpenAICompatibleAdapter | undefined {
    return this.adapters.get(providerId);
  }

  listProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Routes a model identifier of shape `"<modelId>@<providerId>"` to the
   * registered provider. Returns undefined when the format doesn't match
   * or the provider isn't registered.
   */
  resolveByModel(modelString: string): OpenAICompatibleAdapter | undefined {
    const at = modelString.lastIndexOf("@");
    if (at === -1) return undefined;
    const providerId = modelString.slice(at + 1);
    return this.adapters.get(providerId);
  }
}

/**
 * Factory + side-effect: instantiates an OpenAICompatibleAdapter from
 * config and registers it under `config.name`.
 */
export function registerOpenAICompatibleProvider(
  registry: ProviderAdapterRegistry,
  config: OpenAICompatibleProviderConfig,
  options: Pick<OpenAICompatibleAdapterOptions, "fetchImpl" | "retry"> = {},
): OpenAICompatibleAdapter {
  // baseUrl from schema is the /v1/... root; adapter expects the full chat
  // endpoint. Append /chat/completions if user provided the root.
  const adapterBaseUrl = /\/chat\/completions$/.test(config.baseUrl)
    ? config.baseUrl
    : config.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const adapter = new OpenAICompatibleAdapter({
    providerId: config.name,
    baseUrl: adapterBaseUrl,
    apiKey: config.apiKey ?? undefined,
    costPerToken: config.costPerToken,
    fetchImpl: options.fetchImpl,
    retry: options.retry,
  });
  registry.register(adapter);
  return adapter;
}
