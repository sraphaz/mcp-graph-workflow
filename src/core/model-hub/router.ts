/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-model-hub — OpenAI-compatible HTTP router (Task 1.2)
 * Mounts: POST /v1/chat/completions, POST /v1/embeddings,
 *         GET /v1/models, GET /healthz.
 * Routing is purely config-driven (model → backend name → adapter).
 */

import { Router } from "express";
import type { LocalBackendAdapter } from "./adapters/base.js";
import { createLogger } from "../utils/logger.js";
import { generateId } from "../utils/id.js";

const log = createLogger({ layer: "core", source: "model-hub/router" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelHubRouterOptions {
  adapters: Record<string, LocalBackendAdapter>;
  models: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createModelHubRouter(opts: ModelHubRouterOptions): Router {
  const { adapters, models } = opts;
  const router = Router();

  function resolveAdapter(model: string): LocalBackendAdapter | null {
    const backend = models[model];
    if (!backend) return null;
    return adapters[backend] ?? null;
  }

  // POST /v1/chat/completions
  router.post("/v1/chat/completions", (req, res, next) => {
    void (async () => {
      try {
        const { model, messages, stream } = req.body as {
          model: string;
          messages: { role: string; content: string }[];
          stream?: boolean;
        };

        const adapter = resolveAdapter(model);
        if (!adapter) {
          res.status(404).json({
            error: { code: "model_not_found", message: `Model '${model}' not found in registry`, type: "invalid_request_error" },
          });
          return;
        }

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const id = `chatcmpl-${generateId("ch")}`;
          for await (const chunk of adapter.complete({ model, messages: messages as Parameters<LocalBackendAdapter["complete"]>[0]["messages"] })) {
            const payload = {
              id,
              object: "chat.completion.chunk",
              model,
              choices: [{ delta: { content: chunk.text }, finish_reason: chunk.finishReason, index: 0 }],
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }

        // Non-streaming: collect all chunks
        const parts: string[] = [];
        let finishReason: string | null = null;
        for await (const chunk of adapter.complete({ model, messages: messages as Parameters<LocalBackendAdapter["complete"]>[0]["messages"] })) {
          parts.push(chunk.text);
          if (chunk.finishReason) finishReason = chunk.finishReason;
        }

        res.json({
          id: `chatcmpl-${generateId("ch")}`,
          object: "chat.completion",
          model,
          choices: [{
            index: 0,
            message: { role: "assistant", content: parts.join("") },
            finish_reason: finishReason,
          }],
          usage: { prompt_tokens: 0, completion_tokens: parts.join("").length, total_tokens: parts.join("").length },
        });
      } catch (err) {
        log.warn("chat/completions error", { err: String(err) });
        next(err);
      }
    })();
  });

  // POST /v1/embeddings
  router.post("/v1/embeddings", (req, res, next) => {
    void (async () => {
      try {
        const { model = "default", input } = req.body as { model?: string; input: string | string[] };
        const backendName = Object.keys(adapters)[0];
        const adapter = backendName ? adapters[backendName] : null;
        if (!adapter) {
          res.status(503).json({ error: { code: "no_adapter", message: "No backend available" } });
          return;
        }
        const embeddings = await adapter.embeddings({ model, input });
        const data = embeddings.map((vec, i) => ({ object: "embedding", index: i, embedding: vec }));
        res.json({ object: "list", data, model });
      } catch (err) {
        next(err);
      }
    })();
  });

  // GET /v1/models
  router.get("/v1/models", (_req, res, next) => {
    void (async () => {
      try {
        const allModels: { id: string; object: "model"; created: number; owned_by: string }[] = [];
        for (const [, adapter] of Object.entries(adapters)) {
          const list = await adapter.listModels();
          allModels.push(...list);
        }
        res.json({ object: "list", data: allModels });
      } catch (err) {
        next(err);
      }
    })();
  });

  // GET /healthz
  router.get("/healthz", (_req, res, next) => {
    void (async () => {
      try {
        const results: Record<string, string> = {};
        for (const [name, adapter] of Object.entries(adapters)) {
          const h = await adapter.health();
          results[name] = h.status;
        }
        res.json({ status: "ok", backends: results });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
