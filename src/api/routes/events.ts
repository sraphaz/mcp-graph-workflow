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

import { Router } from "express";
import type { GraphEventBus } from "../../core/events/event-bus.js";
import type { GraphEvent } from "../../core/events/event-types.js";
import { logger } from "../../core/utils/logger.js";

export function createEventsRouter(eventBus: GraphEventBus): Router {
  const router = Router();

  /**
   * GET /events
   * Server-Sent Events stream for real-time graph updates.
   */
  router.get("/", (req, res) => {
    logger.info("SSE client connected");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send initial keepalive
    res.write(": connected\n\n");

    const handler = (event: GraphEvent): void => {
      const data = JSON.stringify(event);
      res.write(`event: ${event.type}\ndata: ${data}\n\n`);
    };

    eventBus.on("*", handler);

    // Keepalive every 30s
    const keepalive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 30_000);

    // Cleanup on disconnect
    req.on("close", () => {
      logger.info("SSE client disconnected");
      eventBus.off("*", handler);
      clearInterval(keepalive);
    });
  });

  return router;
}
