/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — ProviderAdapter contract (ADR-llm-02).
 * Each LLM provider implements this interface. Gateway routes by model id.
 */

import type { LlmRequest, LlmResponse, ModelSpec, ProviderName, EmbedRequest, EmbedResponse } from "../types.js";

export interface ProviderAdapter {
  readonly name: ProviderName;
  generate(req: LlmRequest): Promise<LlmResponse>;
  models(): ModelSpec[];
  embed?(req: EmbedRequest): Promise<EmbedResponse>;
}
