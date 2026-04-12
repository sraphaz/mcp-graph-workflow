/**
 * SSE (Server-Sent Events) endpoint for real-time dashboard updates.
 * Streams GraphEventBus events to connected browsers without polling.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import type { GraphEventBus } from "../../core/events/event-bus.js";
import type { GraphEvent } from "../../core/events/event-types.js";
import { logger } from "../../core/utils/logger.js";

/** Active SSE connections for cleanup tracking */
const clients = new Set<Response>();

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
  logger.debug("SSE client connected", { totalClients: clients.size });

  // Forward all graph events to this client, using event.type as SSE event name
  const handler = (event: GraphEvent): void => {
    try {
      const data = JSON.stringify(event.payload ?? {});
      // Send with both the specific event type (for useSSE) and "graph" (for useEventSource)
      res.write(`event: ${event.type}\ndata: ${data}\n\n`);
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
    logger.debug("SSE client disconnected", { totalClients: clients.size });
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
}

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
