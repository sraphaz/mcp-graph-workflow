/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Provider-agnostic LLM client for browser-harness self-heal.
 * Supports Anthropic (Messages API) and GitHub Copilot (OpenAI-compatible
 * chat completions). Uses fetch — no SDK dependency.
 */

import { createLogger } from "../utils/logger.js";
import { OperationError } from "../utils/errors.js";

const log = createLogger({ layer: "core", source: "llm-client.ts" });

export type LlmProvider = "anthropic" | "copilot";

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
  raw?: unknown;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

export interface LlmClientOptions {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  /** Override default endpoint (mostly for tests). */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  retry?: RetryConfig;
  /** Max output tokens — default 1024. */
  maxTokens?: number;
  /** Temperature — default 0.0. */
  temperature?: number;
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  message?: string;
}

const ANTHROPIC_DEFAULT_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const COPILOT_DEFAULT_URL = "https://api.githubcopilot.com/chat/completions";
const EDITOR_VERSION = "mcp-graph/1";

const DEFAULT_RETRY: RetryConfig = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 8000 };

export class LlmClient {
  private readonly fetch: typeof fetch;
  private readonly retry: RetryConfig;

  constructor(private readonly options: LlmClientOptions) {
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    if (!this.fetch) {
      throw new OperationError("fetch is not available — pass fetchImpl or upgrade Node.js");
    }
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  async generate(messages: readonly LlmMessage[]): Promise<LlmResult> {
    return this.options.provider === "anthropic"
      ? this.generateAnthropic(messages)
      : this.generateCopilot(messages);
  }

  async probe(): Promise<ProbeResult> {
    try {
      const resultValue = await this.withRetry(() =>
        this.generate([{ role: "user", content: "." }]),
      );
      return { ok: true, status: 200, message: resultValue.text.slice(0, 32) };
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0;
      return { ok: false, status, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async generateAnthropic(messages: readonly LlmMessage[]): Promise<LlmResult> {
    const url = this.options.baseUrl ?? ANTHROPIC_DEFAULT_URL;
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const body = {
      model: this.options.model,
      max_tokens: this.options.maxTokens ?? 1024,
      temperature: this.options.temperature ?? 0,
      system: system || undefined,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    };

    const response = await this.withRetry(async () => {
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
        const err = await readError(resValue);
        throw withStatus(new Error(`anthropic ${resValue.status}: ${err}`), resValue.status);
      }
      return (await resValue.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
      };
    });

    const text = response.content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("");

    return {
      text,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cachedInputTokens: response.usage.cache_read_input_tokens,
          }
        : undefined,
      raw: response,
    };
  }

  private async generateCopilot(messages: readonly LlmMessage[]): Promise<LlmResult> {
    const url = this.options.baseUrl ?? COPILOT_DEFAULT_URL;
    const body = {
      model: this.options.model,
      max_tokens: this.options.maxTokens ?? 1024,
      temperature: this.options.temperature ?? 0,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const response = await this.withRetry(async () => {
      const resValue = await this.fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "editor-version": EDITOR_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resValue.ok) {
        const err = await readError(resValue);
        throw withStatus(new Error(`copilot ${resValue.status}: ${err}`), resValue.status);
      }
      return (await resValue.json()) as {
        choices: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
    });

    const text = response.choices[0]?.message?.content ?? "";
    return {
      text,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
      raw: response,
    };
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number }).status ?? 0;
        const retryable = status === 429 || (status >= 500 && status < 600) || status === 0;
        if (!retryable || attempt === this.retry.maxAttempts) throw err;
        const delay = Math.min(
          this.retry.maxDelayMs ?? 8000,
          this.retry.baseDelayMs * 2 ** (attempt - 1),
        );
        log.warn("bh:llm:retry", { attempt, status, delayMs: delay });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }
}

function withStatus(err: Error, status: number): Error {
  (err as unknown as { status: number }).status = status;
  return err;
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return res.statusText;
  }
}
