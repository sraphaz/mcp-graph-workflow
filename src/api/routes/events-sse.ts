/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * SSE (Server-Sent Events) endpoint for real-time dashboard updates.
 * Streams GraphEventBus events to connected browsers without polling.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import type { GraphEventBus } from "../../core/events/event-bus.js";
import type { GraphEvent } from "../../core/events/event-types.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "api", source: "events-sse.ts" });

/** Active SSE connections for cleanup tracking */
const clients = new Set<Response>();

/**
 * Upper bound on concurrent SSE clients. When exceeded, the oldest connection
 * is closed to make room — `Set` preserves insertion order so the first
 * iterator value is the least recently added. Prevents unbounded growth if a
 * misbehaving client keeps opening new streams without closing old ones.
 */
const MAX_SSE_CLIENTS = 20;

function handleSSE(
  req: Request,
  res: Response,
  eventBus: GraphEventBus,
): void {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  clients.add(res);

  // Drop the oldest client when the cap is exceeded.
  while (clients.size > MAX_SSE_CLIENTS) {
    const oldest = clients.values().next().value;
    if (!oldest || oldest === res) break;
    clients.delete(oldest);
    try {
      oldest.end();
    } catch {
      // Connection already closed — ignore.
    }
    log.warn("SSE client capacity exceeded — dropped oldest", { cap: MAX_SSE_CLIENTS });
  }

  log.debug("SSE client connected", { totalClients: clients.size });

  // Forward all graph events to this client, using event.type as SSE event name
  const handler = (event: GraphEvent): void => {
    try {
      const dataValue = JSON.stringify(event.payload ?? {});
      // Send with both the specific event type (for useSSE) and "graph" (for useEventSource)
      res.write(`event: ${event.type}\ndata: ${dataValue}\n\n`);
    } catch {
      cleanup();
    }
  };

  eventBus.on("*", handler);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, 30_000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    eventBus.off("*", handler);
    clients.delete(res);
    log.debug("SSE client disconnected", { totalClients: clients.size });
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
}

/** createEventsSseRouter — auto-generated description placeholder. */
export function createEventsSseRouter(eventBus: GraphEventBus | undefined): Router {
  const router = Router();

  // Root GET /api/v1/events — SSE stream (used by useSSE hook)
  router.get("/", (req, res) => {
    if (!eventBus) {
      res.status(503).json({ error: "EventBus not available" });
      return;
    }
    handleSSE(req, res, eventBus);
  });

  // Also available at /stream for explicit SSE path
  router.get("/stream", (req, res) => {
    if (!eventBus) {
      res.status(503).json({ error: "EventBus not available" });
      return;
    }
    handleSSE(req, res, eventBus);
  });

  router.get("/clients", (_req, res) => {
    res.json({ count: clients.size });
  });

  return router;
}
