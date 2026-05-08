/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-gpu-backends — vLLM local backend adapter (Task 1.1)
 * Implements LocalBackendAdapter against the vLLM OpenAI-compatible API.
 * Uses native fetch only — no new runtime dependencies.
 */

import { createLogger } from "../../utils/logger.js";

const log = createLogger({ layer: "core", source: "model-hub/adapters/vllm" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VllmConfig {
  endpoint?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  model: string;
  messages: ChatMessage[];
}

export type HealthStatus = "ok" | "not_configured" | "unavailable";

export interface HealthResult {
  status: HealthStatus;
  version?: string;
  hint?: string;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class VllmAdapter {
  private readonly endpoint: string;

  constructor(config: VllmConfig = {}) {
    this.endpoint = (config.endpoint ?? "").replace(/\/$/, "");
  }

  async health(): Promise<HealthResult> {
    if (!this.endpoint) {
      return { status: "not_configured" };
    }

    try {
      const res = await fetch(`${this.endpoint}/v1/models`);
      if (!res.ok) {
        log.warn("vllm health check non-200", { status: res.status, endpoint: this.endpoint });
        return { status: "unavailable", hint: "Check that vLLM is running at the configured endpoint" };
      }
      const version = res.headers.get("x-vllm-version") ?? undefined;
      return { status: "ok", ...(version !== undefined && { version }) };
    } catch (err) {
      log.warn("vllm health check failed", { endpoint: this.endpoint, err: String(err) });
      return {
        status: "unavailable",
        hint: "Cannot reach vLLM endpoint — configure the correct endpoint URL",
      };
    }
  }

  async *stream(req: StreamRequest, signal: AbortSignal): AsyncGenerator<string> {
    if (!this.endpoint) {
      throw new Error("vLLM endpoint not configured");
    }

    const res = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: true }),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`vLLM stream request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.replace(/^data: /, "").trim();
          if (!trimmed || trimmed === "[DONE]") continue;
          try {
            const parsed = JSON.parse(trimmed) as { choices?: Array<{ delta?: { content?: string } }> };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
