/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-DETERMINISTIC-FIRST — local-hub adapter (Task 3.2)
 *
 * Thin specialization of OpenAICompatibleAdapter for the "local-hub" provider
 * (GLM quantized, llama.cpp, ollama, or any OpenAI-compatible local daemon).
 *
 * Substitutability axiom (ADR-0059): swapping the daemon is a config change.
 * Cost is always 0 (local inference = free electricity, not tracked here).
 *
 * Network errors are re-thrown as BackendUnreachable (§core/model-hub) so
 * callers can distinguish "daemon offline" from transient HTTP errors.
 */

import { LlmTransportError } from "../errors.js";
import { withRetry, type RetryConfig } from "../retry.js";
import type { LlmRequest, LlmResponse, LlmUsage, ModelSpec } from "../types.js";
import type { ProviderAdapter } from "./base.js";
import type { BackendUnreachable } from "../../model-hub/adapters/base.js";
import { OperationError } from "../../utils/errors.js";

export interface LocalHubAdapterOptions {
  /** Full URL of the chat-completions endpoint (e.g. http://localhost:8080/v1/chat/completions). */
  baseUrl: string;
  /** Optional bearer token. Most local daemons skip auth. */
  apiKey?: string;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Override retry policy. */
  retry?: RetryConfig;
}

interface ChatCompletionBody {
  choices: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const CONSERVATIVE_RETRY: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 250,
  maxDelayMs: 2000,
};

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

export class LocalHubAdapter implements ProviderAdapter {
  readonly name = "local-hub" as const;

  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: LocalHubAdapterOptions) {
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new OperationError(
        "fetch is not available — pass fetchImpl or upgrade Node.js",
      );
    }
    this.retry = options.retry ?? CONSERVATIVE_RETRY;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const url = this.options.baseUrl;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.options.apiKey) headers.authorization = `Bearer ${this.options.apiKey}`;

    const body = {
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    let resValue: Response;
    try {
      resValue = await withRetry(async () => {
        const res = await this.fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await readBody(res);
          throw new LlmTransportError("local-hub", `${res.status}: ${text}`);
        }
        return res;
      }, this.retry);
    } catch (cause) {
      if (cause instanceof LlmTransportError) throw cause;
      // Network-level failure (ECONNREFUSED, etc.) → BackendUnreachable
      const typed: BackendUnreachable & Error = Object.assign(
        new Error(cause instanceof Error ? cause.message : String(cause)),
        {
          kind: "BackendUnreachable" as const,
          endpoint: url,
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      );
      throw typed;
    }

    const response = (await resValue.json()) as ChatCompletionBody;

    const usage: LlmUsage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };

    return {
      kind: "final",
      model: req.model,
      content: response.choices[0]?.message?.content ?? "",
      usage,
      raw: response,
    };
  }

  estimateCostUsd(_usage: LlmUsage): number {
    return 0;
  }

  models(): ModelSpec[] {
    return [];
  }
}
