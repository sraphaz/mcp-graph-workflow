/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 5: Trace/correlation ID propagation
 * Generates a ULID-like traceId per request and injects it into req.context.
 * Honours X-Trace-Id header for upstream correlation.
 */

import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export interface RequestContext {
  traceId: string;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

function generateTraceId(): string {
  const ts = Date.now().toString(36).padStart(9, "0");
  const rnd = randomBytes(8).toString("hex");
  return `${ts}${rnd}`;
}

export function traceContext(req: Request, _res: Response, next: NextFunction): void {
  const upstream = req.headers["x-trace-id"];
  req.context = {
    traceId: typeof upstream === "string" && upstream.length > 0 ? upstream : generateTraceId(),
  };
  next();
}
