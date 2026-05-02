/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — OpenRouter adapter (OpenAI-compatible API).
 * model id format `<provider>/<model>` is passed through unchanged.
 */

import { LlmAuthError, LlmRateLimitError, LlmTransportError } from "../errors.js";
import { defaultRegistry } from "../registry.js";
import { withRetry, type RetryConfig, DEFAULT_RETRY } from "../retry.js";
import type { LlmRequest, LlmResponse, ModelSpec } from "../types.js";
import type { ProviderAdapter } from "./base.js";
import { OperationError } from "../../utils/errors.js";

const OPENROUTER_DEFAULT_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterAdapterOptions {
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

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly name = "openrouter" as const;
  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: OpenRouterAdapterOptions) {
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new OperationError("fetch is not available — pass fetchImpl or upgrade Node.js");
    }
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const url = this.options.baseUrl ?? OPENROUTER_DEFAULT_URL;
    const body = {
      model: req.model,
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
          throw new LlmAuthError("openrouter", `${resValue.status}: ${text}`);
        }
        if (resValue.status === 429) {
          throw new LlmRateLimitError("openrouter", parseRetryAfter(resValue.headers));
        }
        const err = new LlmTransportError("openrouter", `${resValue.status}: ${text}`) as LlmTransportError & {
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

  models(): ModelSpec[] {
    return defaultRegistry.list({ allowExpensive: true }).filter((m) => m.provider === "openrouter");
  }
}
