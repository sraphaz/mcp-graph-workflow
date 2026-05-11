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

import type { Request, Response, NextFunction } from "express";
import { logger } from "../../core/utils/logger.js";
import { httpRequestsTotal, httpErrorsTotal, httpDurationMs } from "../../core/observability/metrics.js";

/**
 * Express middleware that logs every HTTP request with method, path, status, and duration.
 * Also increments RED metrics: http.requests.total, http.errors.total, http.duration.ms.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - start);
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("http:request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    });

    httpRequestsTotal.increment();
    if (res.statusCode >= 400) httpErrorsTotal.increment();
    httpDurationMs.observe(durationMs);
  });

  next();
}
