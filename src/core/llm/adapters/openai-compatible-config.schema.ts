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
 * §EPIC-DETERMINISTIC-FIRST — OpenAI-compatible provider config schema.
 *
 * Declares any OpenAI-compatible HTTP endpoint as an LLM provider —
 * including local quantized models (GLM, Qwen, Llama) served via vLLM,
 * llama.cpp, ollama, or any custom server respecting the contract.
 *
 * Substitutability axiom (ADR-0059): swapping the GLM server for any
 * other compatible server must be a config change, not a code change.
 *
 * Rule reference: .claude/rules/deterministic-first.md
 * ADR: docs/_internal/adr/0059-deterministic-first.md
 * PRD: docs/prd/glm-local-provider-config.md
 */

import { z } from "zod/v4";

export const OpenAICompatibleProviderConfigSchema = z.object({
  /** Provider slug used to address it via `model: "<id>@<name>"`. */
  name: z.string().min(1, "name must be a non-empty slug"),
  /** Base URL of the OpenAI-compatible endpoint (`/v1/...`). */
  baseUrl: z.url("baseUrl must be a valid URL"),
  /**
   * Optional bearer token. Some local servers don't require auth.
   * Accepts string, null, or undefined.
   */
  apiKey: z.string().nullish(),
  /** Model IDs the server is expected to expose. Must contain ≥1. */
  models: z.array(z.string().min(1)).min(1, "at least one model required"),
  /** Default request timeout in milliseconds. */
  defaultTimeoutMs: z.number().int().positive().default(60000),
  /** USD per token. Local servers should leave at 0. */
  costPerToken: z.number().nonnegative().default(0),
  /** Health probe endpoint relative to baseUrl. */
  healthEndpoint: z.string().default("/v1/models"),
  /** Embedding model IDs served by this provider (distinct from chat models). Default []. */
  embeddingModels: z.array(z.string().min(1)).default([]),
});

export type OpenAICompatibleProviderConfig = z.infer<
  typeof OpenAICompatibleProviderConfigSchema
>;
