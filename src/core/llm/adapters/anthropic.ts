/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — Anthropic adapter (Messages API).
 * Ported from src/core/browser-harness/llm-client.ts (generateAnthropic).
 */

import {
  LlmAuthError,
  LlmContextWindowError,
  LlmRateLimitError,
  LlmTransportError,
} from "../errors.js";
import { defaultRegistry } from "../registry.js";
import { withRetry, type RetryConfig, DEFAULT_RETRY } from "../retry.js";
import type { LlmRequest, LlmResponse, ModelSpec } from "../types.js";
import type { ProviderAdapter } from "./base.js";
import { OperationError } from "../../utils/errors.js";

const ANTHROPIC_DEFAULT_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  retry?: RetryConfig;
}

interface AnthropicResponseBody {
  content: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

function parseRetryAfter(headers: Headers): number {
  const value = headers.get("retry-after");
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 1000;
}

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

function stripPrefix(modelId: string): string {
  return modelId.startsWith("anthropic/") ? modelId.slice("anthropic/".length) : modelId;
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic" as const;
  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: AnthropicAdapterOptions) {
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new OperationError("fetch is not available — pass fetchImpl or upgrade Node.js");
    }
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const url = this.options.baseUrl ?? ANTHROPIC_DEFAULT_URL;
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const body = {
      model: stripPrefix(req.model),
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      system: system || undefined,
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    };

    const response = await withRetry(async () => {
      const resValue = await this.fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.options.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resValue.ok) {
        const text = await readBody(resValue);
        if (resValue.status === 401 || resValue.status === 403) {
          throw new LlmAuthError("anthropic", `${resValue.status}: ${text}`);
        }
        if (resValue.status === 429) {
          throw new LlmRateLimitError("anthropic", parseRetryAfter(resValue.headers));
        }
        if (resValue.status === 413) {
          throw new LlmContextWindowError(req.model, req.maxTokens ?? 0, 0);
        }
        const err = new LlmTransportError("anthropic", `${resValue.status}: ${text}`) as LlmTransportError & {
          status: number;
        };
        err.status = resValue.status;
        throw err;
      }
      return (await resValue.json()) as AnthropicResponseBody;
    }, this.retry);

    const content = response.content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("");

    return {
      kind: "final",
      model: req.model,
      content,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        cachedInputTokens: response.usage?.cache_read_input_tokens,
        cacheCreationInputTokens: response.usage?.cache_creation_input_tokens,
      },
      raw: response,
    };
  }

  /**
   * SSE streaming variant — parses content_block_delta events and invokes `streamDelta` per chunk.
   * Calls `streamDelta(null)` as the final terminator. Returns full LlmResponse on completion.
   */
  async generateStream(
    req: LlmRequest,
    streamDelta: (chunk: string | null) => void,
  ): Promise<LlmResponse> {
    const url = this.options.baseUrl ?? ANTHROPIC_DEFAULT_URL;
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const body = {
      model: stripPrefix(req.model),
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      system: system || undefined,
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    const resValue = await this.fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": this.options.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resValue.ok) {
      const text = await readBody(resValue);
      if (resValue.status === 401 || resValue.status === 403) throw new LlmAuthError("anthropic", `${resValue.status}: ${text}`);
      if (resValue.status === 429) throw new LlmRateLimitError("anthropic", parseRetryAfter(resValue.headers));
      if (resValue.status === 413) throw new LlmContextWindowError(req.model, req.maxTokens ?? 0, 0);
      const err = new LlmTransportError("anthropic", `${resValue.status}: ${text}`) as LlmTransportError & { status: number };
      err.status = resValue.status;
      throw err;
    }

    if (!resValue.body) throw new OperationError("anthropic stream: empty response body");
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
          if (event["type"] === "content_block_delta") {
            const delta = event["delta"] as Record<string, unknown> | undefined;
            if (delta?.["type"] === "text_delta" && typeof delta["text"] === "string") {
              content += delta["text"] as string;
              streamDelta(delta["text"] as string);
            }
          } else if (event["type"] === "message_start") {
            const msg = event["message"] as Record<string, unknown> | undefined;
            const uVar = msg?.["usage"] as Record<string, unknown> | undefined;
            if (typeof uVar?.["input_tokens"] === "number") inputTokens = uVar["input_tokens"] as number;
          } else if (event["type"] === "message_delta") {
            const uVar = event["usage"] as Record<string, unknown> | undefined;
            if (typeof uVar?.["output_tokens"] === "number") outputTokens = uVar["output_tokens"] as number;
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }

    streamDelta(null);
    return { kind: "final", model: req.model, content, usage: { inputTokens, outputTokens } };
  }

  models(): ModelSpec[] {
    return defaultRegistry.list({ allowExpensive: true }).filter((m) => m.provider === "anthropic");
  }
}
