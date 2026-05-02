/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — OpenAI-compatible request/response shape.
 *
 * Per ADR-proxy-02: this module is the boundary between the OpenAI client
 * dialect (used by browser-use, Continue, Cline, codex, etc.) and the
 * internal LlmRequest/LlmResponse contract that LlmGateway consumes.
 * Streaming SSE is deferred to v12.1 (ADR-proxy-04).
 */

import { z } from "zod/v4";
import type { LlmRequest, LlmResponse } from "../llm/types.js";
import { OperationError } from "../utils/errors.js";

// ── OpenAI request schema (subset we honor) ────────────────────

const OpenAiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
});

export const OpenAiChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(OpenAiMessageSchema).min(1),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
  user: z.string().optional(),
}).passthrough();

export type OpenAiChatCompletionRequest = z.infer<typeof OpenAiChatCompletionRequestSchema>;

// ── OpenAI response shape (what we return) ─────────────────────

export interface OpenAiChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: 0;
    message: { role: "assistant"; content: string };
    finish_reason: "stop" | "length" | "content_filter";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ── Conversions ────────────────────────────────────────────────

export function toLlmRequest(body: OpenAiChatCompletionRequest): LlmRequest {
  if (body.stream === true) {
    throw new OperationError("streaming not supported in v1 (ADR-proxy-04)");
  }
  // OpenAI's "tool" role is not in the internal ChatMessage enum (system/user/
  // assistant only). Downgrade tool messages to "user" with a [tool] prefix so
  // their content still reaches the model. Lossy on purpose — tool-call shape
  // mapping is a v2 concern (ADR-proxy-02).
  const messages = body.messages.map((m) =>
    m.role === "tool"
      ? { role: "user" as const, content: `[tool] ${m.content}` }
      : { role: m.role, content: m.content },
  );
  return {
    model: body.model,
    messages,
    ...(body.max_tokens !== undefined ? { maxTokens: body.max_tokens } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    stream: false,
  };
}

export function toOpenAiResponse(res: LlmResponse): OpenAiChatCompletionResponse {
  const id = `chatcmpl-${cryptoRandomId()}`;
  const promptTokens = res.usage.inputTokens;
  const completionTokens = res.usage.outputTokens;
  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: res.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: res.content },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

function cryptoRandomId(): string {
  // Lightweight: 16 hex chars; collision-resistant enough for chat completion ids.
  const arr = new Uint8Array(8);
  // Node 24+ globalThis.crypto is available; fallback for older runtimes via crypto module.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(arr);
  else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
