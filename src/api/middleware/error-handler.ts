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
import { z } from "zod/v4";
import {
  McpGraphError,
  GraphNotInitializedError,
  NodeNotFoundError,
  ValidationError,
  SnapshotNotFoundError,
  FileNotFoundError,
} from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

interface ErrorResponseBody {
  error: string;
  details?: unknown;
}

function isBodyParserSyntaxError(err: Error): boolean {
  return err instanceof SyntaxError && "body" in err;
}

function mapErrorToStatus(err: Error): number {
  if (err instanceof GraphNotInitializedError) return 409;
  if (err instanceof NodeNotFoundError) return 404;
  if (err instanceof FileNotFoundError) return 404;
  if (err instanceof SnapshotNotFoundError) return 404;
  if (err instanceof ValidationError) return 400;
  if (err instanceof z.ZodError) return 400;
  if (err instanceof McpGraphError) return 400;
  if (isBodyParserSyntaxError(err)) return 400;
  return 500;
}

/** errorHandler — auto-generated description placeholder. */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = mapErrorToStatus(err);
  const body: ErrorResponseBody = { error: err.message };

  if (err instanceof ValidationError) {
    body.details = err.issues;
  } else if (err instanceof z.ZodError) {
    body.details = err.issues;
  }

  if (status >= 500) {
    logger.error("Unhandled API error", {
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
    });
  } else if (status >= 400) {
    logger.warn("API client error", {
      method: req.method,
      path: req.path,
      status,
      error: err.message,
    });
  }

  res.status(status).json(body);
}
