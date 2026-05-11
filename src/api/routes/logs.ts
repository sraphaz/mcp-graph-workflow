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

import { Router, type Request } from "express";
import { z } from "zod/v4";
import { getLogBuffer, clearLogBuffer, logger } from "../../core/utils/logger.js";
import { toEcs } from "../../core/utils/ecs-formatter.js";
import { LogLevelSchema, type LogEntry } from "../../schemas/log.schema.js";

const IngestEntrySchema = z.object({
  level: LogLevelSchema,
  message: z.string().min(1).max(4096),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
});

const IngestPayloadSchema = z.object({
  entries: z.array(IngestEntrySchema).min(1).max(100),
});

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return (fwd.split(",")[0] ?? fwd).trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    const first = fwd[0] ?? "";
    return (first.split(",")[0] ?? first).trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

interface RateLimiter {
  check(ip: string, now: number): boolean;
}

function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(ip, now) {
      const cutoff = now - windowMs;
      const arr = (hits.get(ip) ?? []).filter((t) => t > cutoff);
      if (arr.length >= max) {
        hits.set(ip, arr);
        return false;
      }
      arr.push(now);
      hits.set(ip, arr);
      return true;
    },
  };
}

/**
 * Remove the `stack` key from a log entry's context to prevent stack trace
 * disclosure in the public logs API endpoint.
 */
export function stripStackFromLogContext(
  ctx: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const { stack: _stack, ...safe } = ctx;
  return safe;
}

function sanitizeLogEntry(entry: LogEntry): LogEntry {
  return { ...entry, context: stripStackFromLogContext(entry.context) };
}

/** createLogsRouter — auto-generated description placeholder. */
export function createLogsRouter(): Router {
  const router = Router();
  const rateLimiter = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  /**
   * POST /logs/ingest
   * Accepts a batch of client-side log entries. `layer` in context is forced
   * to `"web"` server-side; rate-limited to 100 req/min per IP.
   */
  router.post("/ingest", (req, res) => {
    const ip = clientIp(req);
    if (!rateLimiter.check(ip, Date.now())) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    const parsed = IngestPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
      return;
    }

    for (const entry of parsed.data.entries) {
      const context = { ...(entry.context ?? {}), layer: "web" };
      logger[entry.level](entry.message, context);
    }

    res.status(202).json({ accepted: parsed.data.entries.length });
  });

  /**
   * GET /logs
   * Returns buffered log entries with optional filters.
   * Query params: level, since (id), search (text), format ("ecs" for ECS shape)
   */
  router.get("/", (req, res) => {
    let logs = getLogBuffer();

    const { level, since, search, format, category } = req.query;

    if (typeof level === "string" && level.length > 0) {
      logs = logs.filter((entry) => entry.level === level);
    }

    if (typeof since === "string" && since.length > 0) {
      const sinceId = Number(since);
      if (!Number.isNaN(sinceId)) {
        logs = logs.filter((entry) => entry.id > sinceId);
      }
    }

    if (typeof search === "string" && search.length > 0) {
      const term = search.toLowerCase();
      logs = logs.filter((entry) => entry.message.toLowerCase().includes(term));
    }

    if (typeof category === "string" && category.length > 0) {
      logs = logs.filter((entry) => entry.context?.["eventCategory"] === category);
    }

    const sanitized = logs.map(sanitizeLogEntry);
    if (format === "ecs") {
      res.json({ logs: sanitized.map(toEcs), total: sanitized.length });
      return;
    }
    res.json({ logs: sanitized, total: sanitized.length });
  });

  /**
   * DELETE /logs
   * Clears the in-memory log buffer.
   */
  router.delete("/", (_req, res) => {
    clearLogBuffer();
    res.status(204).end();
  });

  return router;
}
