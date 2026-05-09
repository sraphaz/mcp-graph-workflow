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
 * §EPIC-DETERMINISTIC-FIRST — Generic OpenAI-compatible HTTP adapter.
 *
 * Speaks the OpenAI Chat Completions wire protocol against any
 * configurable endpoint (GLM/Qwen/Llama via vLLM, llama.cpp server,
 * ollama, custom). Local-first by default: no apiKey required, cost
 * reported as 0, conservative retry (servers fail fast).
 *
 * `name` is hardcoded to "openai" because the wire protocol IS openai;
 * `providerId` is the user-facing slug used by the registry to route
 * (e.g. `model: "glm-4@glm-local"`).
 *
 * PRD: docs/prd/glm-local-provider-config.md (Task 2.1)
 * ADR: docs/_internal/adr/0059-deterministic-first.md
 */

import {
  LlmAuthError,
  LlmRateLimitError,
  LlmTransportError,
} from "../errors.js";
import { withRetry, type RetryConfig } from "../retry.js";
import type { LlmRequest, LlmResponse, LlmUsage, ModelSpec } from "../types.js";
import type { ProviderAdapter } from "./base.js";
import { OperationError } from "../../utils/errors.js";

const CONSERVATIVE_RETRY: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 250,
  maxDelayMs: 2000,
};

export interface OpenAICompatibleAdapterOptions {
  /** Slug used by the registry to route (e.g. "glm-local"). */
  providerId: string;
  /** Full URL of the OpenAI-compatible chat-completions endpoint. */
  baseUrl: string;
  /** Optional bearer token; many local servers don't require auth. */
  apiKey?: string;
  /** USD per token (sum of input+output). Default 0 for local. */
  costPerToken?: number;
  /** Override fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
  /** Override retry policy. Default conservative. */
  retry?: RetryConfig;
}

interface ChatCompletionBody {
  choices: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function parseRetryAfter(headers: Headers): number {
  const value = headers.get("retry-after");
  if (!value) return 1000;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 1000;
}

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  /** Wire-protocol identity: this adapter speaks the OpenAI shape. */
  readonly name = "openai" as const;
  /** User-facing slug (e.g. "glm-local"). Different from `name`. */
  readonly providerId: string;

  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: OpenAICompatibleAdapterOptions) {
    this.providerId = options.providerId;
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
    const body = {
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.options.apiKey) {
      headers.authorization = `Bearer ${this.options.apiKey}`;
    }

    const response = await withRetry(async () => {
      let resValue: Response;
      try {
        resValue = await this.fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } catch (cause) {
        // Network-level failure (ECONNREFUSED, DNS, abort).
        throw new LlmTransportError(
          this.providerId,
          cause instanceof Error ? cause.message : String(cause),
        );
      }
      if (!resValue.ok) {
        const text = await readBody(resValue);
        if (resValue.status === 401 || resValue.status === 403) {
          throw new LlmAuthError(this.providerId, `${resValue.status}: ${text}`);
        }
        if (resValue.status === 429) {
          throw new LlmRateLimitError(
            this.providerId,
            parseRetryAfter(resValue.headers),
          );
        }
        const err = new LlmTransportError(
          this.providerId,
          `${resValue.status}: ${text}`,
        ) as LlmTransportError & { status: number };
        err.status = resValue.status;
        throw err;
      }
      return (await resValue.json()) as ChatCompletionBody;
    }, this.retry);

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

  /**
   * SSE streaming variant — mirrors OpenAIAdapter.generateStream.
   * Parses `data: {...}\n\n` chunks, invokes streamDelta(token) per chunk,
   * finalises with streamDelta(null) on [DONE]. Mid-stream transport errors
   * propagate as LlmTransportError.
   */
  async generateStream(
    req: LlmRequest,
    streamDelta: (chunk: string | null) => void,
    opts?: { signal?: AbortSignal },
  ): Promise<LlmResponse> {
    const url = this.options.baseUrl;
    const body = {
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.options.apiKey) headers.authorization = `Bearer ${this.options.apiKey}`;

    let resValue: Response;
    try {
      resValue = await this.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: opts?.signal,
      });
    } catch (cause) {
      throw new LlmTransportError(
        this.providerId,
        cause instanceof Error ? cause.message : String(cause),
      );
    }

    if (!resValue.ok) {
      const text = await readBody(resValue);
      if (resValue.status === 401 || resValue.status === 403) throw new LlmAuthError(this.providerId, `${resValue.status}: ${text}`);
      if (resValue.status === 429) throw new LlmRateLimitError(this.providerId, parseRetryAfter(resValue.headers));
      const err = new LlmTransportError(this.providerId, `${resValue.status}: ${text}`) as LlmTransportError & { status: number };
      err.status = resValue.status;
      throw err;
    }

    if (!resValue.body) throw new OperationError(`${this.providerId} stream: empty response body`);
    const reader = resValue.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const event = JSON.parse(raw) as Record<string, unknown>;
          const choices = event["choices"] as Array<Record<string, unknown>> | undefined;
          const delta = choices?.[0]?.["delta"] as Record<string, unknown> | undefined;
          const text = delta?.["content"];
          if (typeof text === "string" && text.length > 0) {
            content += text;
            streamDelta(text);
          }
          const usage = event["usage"] as Record<string, unknown> | undefined;
          if (typeof usage?.["prompt_tokens"] === "number") inputTokens = usage["prompt_tokens"] as number;
          if (typeof usage?.["completion_tokens"] === "number") outputTokens = usage["completion_tokens"] as number;
        } catch { /* ignore malformed SSE lines */ }
      }
    }

    streamDelta(null);
    return { kind: "final", model: req.model, content, usage: { inputTokens, outputTokens } };
  }

  /**
   * Compute cost in USD for given usage. Default 0 (local server, free).
   * Caller can opt-in via `costPerToken` (e.g. tracking electricity cost).
   */
  estimateCostUsd(usage: LlmUsage): number {
    const rate = this.options.costPerToken ?? 0;
    if (rate === 0) return 0;
    return (usage.inputTokens + usage.outputTokens) * rate;
  }

  /**
   * Models are registered out-of-band via config (Task 2.2 health probe will
   * populate). For now, return [] so registry doesn't think we have any.
   */
  models(): ModelSpec[] {
    return [];
  }
}
