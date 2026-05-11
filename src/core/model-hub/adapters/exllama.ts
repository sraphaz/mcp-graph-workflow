/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-gpu-backends — ExLlamaV2 / TabbyAPI HTTP adapter (Task 2.1)
 *
 * TabbyAPI is OpenAI-compatible. This adapter targets its loaded-models
 * endpoint (/v1/models). The available-but-not-loaded list (/v1/internal/model/list)
 * is intentionally NOT used for listModels() — callers see only active models.
 * No auto-spawn. If endpoint is absent, adapter returns not_configured silently.
 */

import { createLogger } from "../../utils/logger.js";

const log = createLogger({ layer: "core", source: "model-hub/adapters/exllama" });

export interface ExllamaConfig {
  endpoint?: string;
}

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export type ExllamaHealthStatus = "ok" | "not_configured" | "unavailable";

export interface ExllamaHealthResult {
  status: ExllamaHealthStatus;
  version?: string;
  hint?: string;
}

export class ExllamaAdapter {
  private readonly endpoint: string;

  constructor(config: ExllamaConfig = {}) {
    this.endpoint = (config.endpoint ?? "").replace(/\/$/, "");
  }

  async health(): Promise<ExllamaHealthResult> {
    if (!this.endpoint) {
      return { status: "not_configured" };
    }

    try {
      const res = await fetch(`${this.endpoint}/v1/models`);
      if (!res.ok) {
        log.warn("tabbyapi health check non-200", { status: res.status, endpoint: this.endpoint });
        return {
          status: "unavailable",
          hint: "Check that TabbyAPI is running at the configured endpoint",
        };
      }
      return { status: "ok" };
    } catch (err) {
      log.warn("tabbyapi health check failed", { endpoint: this.endpoint, err: String(err) });
      return {
        status: "unavailable",
        hint: "Cannot reach TabbyAPI endpoint — configure the correct endpoint URL",
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.endpoint) return [];

    try {
      const res = await fetch(`${this.endpoint}/v1/models`);
      if (!res.ok) return [];
      const body = await res.json() as { data?: unknown[] };
      const data = Array.isArray(body.data) ? body.data : [];
      return data as ModelInfo[];
    } catch (err) {
      log.warn("tabbyapi listModels failed", { endpoint: this.endpoint, err: String(err) });
      return [];
    }
  }
}
