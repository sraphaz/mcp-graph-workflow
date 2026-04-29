/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — LLM error hierarchy.
 * All errors extend McpGraphError so callers can branch on the project base type.
 */

import { McpGraphError } from "../utils/errors.js";
import type { BudgetScope, ProviderName } from "./types.js";

export class LlmAuthError extends McpGraphError {
  constructor(
    public readonly provider: ProviderName | string,
    cause: string,
  ) {
    super(`LLM auth failed for ${provider}: ${cause}`);
    this.name = "LlmAuthError";
  }
}

export class LlmRateLimitError extends McpGraphError {
  constructor(
    public readonly provider: ProviderName | string,
    public readonly retryAfterMs: number,
  ) {
    super(`LLM rate limit hit on ${provider}; retry after ${retryAfterMs}ms`);
    this.name = "LlmRateLimitError";
  }
}

export class LlmBudgetExceededError extends McpGraphError {
  constructor(public readonly details: BudgetScope) {
    super(
      `LLM budget exceeded for ${details.scope}` +
        (details.scopeId ? ` "${details.scopeId}"` : "") +
        `: $${details.currentUsd.toFixed(4)} >= cap $${details.capUsd.toFixed(4)}`,
    );
    this.name = "LlmBudgetExceededError";
  }
}

export class LlmTransportError extends McpGraphError {
  constructor(
    public readonly provider: ProviderName | string,
    cause: string,
  ) {
    super(`LLM transport error on ${provider}: ${cause}`);
    this.name = "LlmTransportError";
  }
}

export class LlmContextWindowError extends McpGraphError {
  constructor(
    public readonly modelId: string,
    public readonly requestedTokens: number,
    public readonly maxTokens: number,
  ) {
    super(
      `LLM context window exceeded for ${modelId}: requested ${requestedTokens} > max ${maxTokens}`,
    );
    this.name = "LlmContextWindowError";
  }
}

export class LlmModelUnknown extends McpGraphError {
  constructor(public readonly modelId: string) {
    super(`Unknown LLM model id: ${modelId}`);
    this.name = "LlmModelUnknown";
  }
}
