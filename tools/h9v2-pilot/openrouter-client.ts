/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Thin OpenRouter API client for the H9v2 pilot.
 * - Never logs the API key (uses maskKey for diagnostics)
 * - Enforces a per-run USD budget cap
 * - Returns both the response and metering (tokens, latency, approx cost)
 */

import { loadApiKey, maskKey } from "./load-key.js";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface BudgetState {
  spentUsd: number;
  maxUsd: number;
}

export class BudgetExceededError extends Error {
  constructor(state: BudgetState) {
    super(
      `Budget cap exceeded: spent $${state.spentUsd.toFixed(4)}, cap $${state.maxUsd.toFixed(2)}`,
    );
    this.name = "BudgetExceededError";
  }
}

export interface OpenRouterClientOptions {
  /** Max USD per entire pilot run (hard cap). Default: $2. */
  maxUsd?: number;
  /** Base dir for locating workflow-graph/key.txt. Default: cwd. */
  baseDir?: string;
  /** Per-request timeout in ms. Default: 120_000 (2 min). */
  timeoutMs?: number;
}

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly maskedKey: string;
  private readonly maxUsd: number;
  private readonly timeoutMs: number;
  private _spentUsd = 0;

  constructor(opts: OpenRouterClientOptions = {}) {
    const key = loadApiKey(opts.baseDir);
    this.apiKey = key.value;
    this.maskedKey = key.masked;
    this.maxUsd = opts.maxUsd ?? 2;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get budget(): BudgetState {
    return { spentUsd: this._spentUsd, maxUsd: this.maxUsd };
  }

  get keyDiagnostic(): string {
    return this.maskedKey;
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    if (this._spentUsd >= this.maxUsd) {
      throw new BudgetExceededError(this.budget);
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://github.com/DiegoNogueiraDev/mcp-graph-workflow",
          "X-Title": "mcp-graph v11 H9v2 pilot",
        },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const bodyText = await response.text();
      // Defensive: strip anything that looks like our key from the error body
      const sanitized = bodyText.replace(new RegExp(this.apiKey, "g"), "[REDACTED]");
      throw new Error(
        `OpenRouter ${response.status}: ${sanitized.slice(0, 500)}`,
      );
    }

    const json = (await response.json()) as OpenRouterResponse;
    const content = json.choices?.[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    // OpenRouter returns cost in the "usage" field as "cost" (or we approximate)
    const costUsd = (json.usage as unknown as { cost?: number } | undefined)?.cost ?? 0;

    this._spentUsd += costUsd;

    return {
      content,
      model: json.model ?? req.model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
      costUsd,
      latencyMs,
    };
  }
}

interface OpenRouterResponse {
  id: string;
  model?: string;
  choices?: Array<{
    message?: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

/** Utility to mask any occurrence of the live key in a text blob (defense in depth). */
export function scrubKey(text: string, liveKey: string): string {
  if (!liveKey || liveKey.length < 8) return text;
  return text.split(liveKey).join(maskKey(liveKey));
}
