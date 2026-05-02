/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — OpenAI native adapter.
 * Strips `openai/` prefix from model id before sending request.
 */

import { LlmAuthError, LlmRateLimitError, LlmTransportError } from "../errors.js";
import { defaultRegistry } from "../registry.js";
import { withRetry, type RetryConfig, DEFAULT_RETRY } from "../retry.js";
import type { LlmRequest, LlmResponse, ModelSpec } from "../types.js";
import type { ProviderAdapter } from "./base.js";
import { OperationError } from "../../utils/errors.js";

const OPENAI_DEFAULT_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAIAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  retry?: RetryConfig;
}

interface ChatCompletionBody {
  choices: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function parseRetryAfter(headers: Headers): number {
  const value = headers.get("retry-after");
  if (!value) return 1000;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 1000;
}

function stripPrefix(modelId: string): string {
  return modelId.startsWith("openai/") ? modelId.slice("openai/".length) : modelId;
}

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = "openai" as const;
  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: OpenAIAdapterOptions) {
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new OperationError("fetch is not available — pass fetchImpl or upgrade Node.js");
    }
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const url = this.options.baseUrl ?? OPENAI_DEFAULT_URL;
    const body = {
      model: stripPrefix(req.model),
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const response = await withRetry(async () => {
      const resValue = await this.fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resValue.ok) {
        const text = await readBody(resValue);
        if (resValue.status === 401 || resValue.status === 403) {
          throw new LlmAuthError("openai", `${resValue.status}: ${text}`);
        }
        if (resValue.status === 429) {
          throw new LlmRateLimitError("openai", parseRetryAfter(resValue.headers));
        }
        const err = new LlmTransportError("openai", `${resValue.status}: ${text}`) as LlmTransportError & {
          status: number;
        };
        err.status = resValue.status;
        throw err;
      }
      return (await resValue.json()) as ChatCompletionBody;
    }, this.retry);

    return {
      kind: "final",
      model: req.model,
      content: response.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      raw: response,
    };
  }

  /**
   * SSE streaming variant — parses choices[0].delta.content events and invokes `streamDelta` per chunk.
   * Calls `streamDelta(null)` as the final terminator. Returns full LlmResponse on completion.
   */
  async generateStream(
    req: LlmRequest,
    streamDelta: (chunk: string | null) => void,
  ): Promise<LlmResponse> {
    const url = this.options.baseUrl ?? OPENAI_DEFAULT_URL;
    const body = {
      model: stripPrefix(req.model),
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    const resValue = await this.fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resValue.ok) {
      const text = await readBody(resValue);
      if (resValue.status === 401 || resValue.status === 403) throw new LlmAuthError("openai", `${resValue.status}: ${text}`);
      if (resValue.status === 429) throw new LlmRateLimitError("openai", parseRetryAfter(resValue.headers));
      const err = new LlmTransportError("openai", `${resValue.status}: ${text}`) as LlmTransportError & { status: number };
      err.status = resValue.status;
      throw err;
    }

    if (!resValue.body) throw new OperationError("openai stream: empty response body");
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

  models(): ModelSpec[] {
    return defaultRegistry.list({ allowExpensive: true }).filter((m) => m.provider === "openai");
  }
}
