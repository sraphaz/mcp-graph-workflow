/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-local-model-hub — Task 4.1: SSE /api/model-hub/stream
 *
 * GET /stream — SSE stream of model-hub events with coalescing (10 evt/s per backend).
 *
 * Events forwarded: backend.online, backend.offline, model.loaded,
 *   inference.started, inference.completed, inference.failed.
 *
 * Returns 503 when eventBus is not wired (api.md rule: structured error, not hang).
 */

import { Router } from "express";
import type { GraphEventBus } from "../../core/events/event-bus.js";
import type { GraphEvent } from "../../core/events/event-types.js";
import { EventCoalescer } from "../../core/browser-harness/event-coalescer.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "api", source: "model-hub.ts" });

const MODEL_HUB_EVENTS = new Set([
  "backend.online",
  "backend.offline",
  "model.loaded",
  "inference.started",
  "inference.completed",
  "inference.failed",
]);

export function createModelHubRouter(eventBus: GraphEventBus | undefined): Router {
  const router = Router();

  router.get("/stream", (_req, res) => {
    if (!eventBus) {
      res.status(503).json({ error: "EventBus not available — model-hub SSE requires a live event bus" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    const coalescer = new EventCoalescer(100, (events) => {
      for (const ev of events) {
        try {
          res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev.payload)}\n\n`);
        } catch {
          // client gone
        }
      }
    });

    const handler = (event: GraphEvent): void => {
      if (!MODEL_HUB_EVENTS.has(event.type)) return;
      const backendId = (event.payload as Record<string, unknown>)?.["backendId"] as string ?? "unknown";
      coalescer.push({ type: event.type, runId: backendId, payload: event.payload ?? {} });
    };

    eventBus.on("*", handler);

    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch { /* client gone */ }
    }, 15000);

    res.on("close", () => {
      eventBus.off("*", handler);
      coalescer.destroy();
      clearInterval(heartbeat);
      log.debug("model-hub SSE client disconnected");
    });
  });

  return router;
}
