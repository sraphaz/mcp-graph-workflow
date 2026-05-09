/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-model-hub — LocalBackendAdapter contract (Task 2.1)
 * All adapters implement this interface. complete() is AsyncIterable so callers
 * can stream tokens natively. Errors are typed discriminated unions — adapters
 * throw Object.assign(new Error(msg), typedError) so both instanceof and
 * structural checks work.
 */

// ---------------------------------------------------------------------------
// Request types (OpenAI-compatible shapes)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface EmbeddingsRequest {
  model?: string;
  input: string | string[];
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface Chunk {
  text: string;
  finishReason: "stop" | "length" | "content_filter" | null;
}

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export type HealthStatusCode = "ok" | "not_configured" | "unavailable";

export interface HealthStatus {
  status: HealthStatusCode;
  version?: string;
  hint?: string;
}

// ---------------------------------------------------------------------------
// Typed errors (AC3)
// ---------------------------------------------------------------------------

export interface BackendUnreachable {
  kind: "BackendUnreachable";
  endpoint: string;
  cause: string;
}

export interface ModelLoadFailed {
  kind: "ModelLoadFailed";
  model: string;
  reason: string;
}

export interface InferenceTimeout {
  kind: "InferenceTimeout";
  model: string;
  timeoutMs: number;
}

export type BackendError = BackendUnreachable | ModelLoadFailed | InferenceTimeout;

// ---------------------------------------------------------------------------
// Canonical interface (AC1 + AC2)
// ---------------------------------------------------------------------------

export interface LocalBackendAdapter {
  /** Stream completion tokens. Throws BackendError on failure. */
  complete(req: CompleteRequest): AsyncIterable<Chunk>;

  /** Compute embeddings for one or more inputs. */
  embeddings(req: EmbeddingsRequest): Promise<number[][]>;

  /** List available models on this backend. */
  listModels(): Promise<ModelInfo[]>;

  /** Probe backend liveness. Never throws — returns status shape. */
  health(): Promise<HealthStatus>;
}
