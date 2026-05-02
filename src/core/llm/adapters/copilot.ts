/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — GitHub Copilot adapter.
 * Ported from src/core/browser-harness/llm-client.ts (generateCopilot).
 * CRITICAL: editor-version header must be exactly preserved (risk node).
 */

import {
  LlmAuthError,
  LlmRateLimitError,
  LlmTransportError,
} from "../errors.js";
import { defaultRegistry } from "../registry.js";
import { withRetry, type RetryConfig, DEFAULT_RETRY } from "../retry.js";
import type { LlmRequest, LlmResponse, ModelSpec } from "../types.js";
import type { ProviderAdapter } from "./base.js";
import { OperationError } from "../../utils/errors.js";

const COPILOT_DEFAULT_URL = "https://api.githubcopilot.com/chat/completions";
export const COPILOT_EDITOR_VERSION = "mcp-graph/1";

export interface CopilotAdapterOptions {
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
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  return 1000;
}

function stripPrefix(modelId: string): string {
  return modelId.startsWith("copilot/") ? modelId.slice("copilot/".length) : modelId;
}

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

export class CopilotAdapter implements ProviderAdapter {
  readonly name = "copilot" as const;
  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: CopilotAdapterOptions) {
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new OperationError("fetch is not available — pass fetchImpl or upgrade Node.js");
    }
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const url = this.options.baseUrl ?? COPILOT_DEFAULT_URL;
    const body = {
      model: stripPrefix(req.model),
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const response = await withRetry(async () => {
      const res = await this.fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "editor-version": COPILOT_EDITOR_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await readBody(res);
        if (res.status === 401 || res.status === 403) {
          throw new LlmAuthError("copilot", `${res.status}: ${text}`);
        }
        if (res.status === 429) {
          throw new LlmRateLimitError("copilot", parseRetryAfter(res.headers));
        }
        const err = new LlmTransportError("copilot", `${res.status}: ${text}`) as LlmTransportError & {
          status: number;
        };
        err.status = res.status;
        throw err;
      }
      return (await res.json()) as ChatCompletionBody;
    }, this.retry);

    const content = response.choices[0]?.message?.content ?? "";
    return {
      kind: "final",
      model: req.model,
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      raw: response,
    };
  }

  models(): ModelSpec[] {
    return defaultRegistry.list({ allowExpensive: true }).filter((m) => m.provider === "copilot");
  }
}
