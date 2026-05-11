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

import type { LogEntry, LogLayer, LogLevel } from "../../schemas/log.schema.js";
import { extractErrorContext } from "./ecs-formatter.js";
import { getTraceContext } from "./trace-store.js";

export interface BusinessEvent {
  action: string;
  category: string;
  outcome: "success" | "failure" | "unknown";
}

const MAX_BUFFER_SIZE = 1000;

const logBuffer: LogEntry[] = [];
let nextId = 1;
let logListener: ((entry: LogEntry) => void) | null = null;

function appendToBuffer(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const trace = getTraceContext();
  const traceFields: Record<string, unknown> = trace
    ? { "trace.id": trace.traceId, "span.id": trace.spanId }
    : {};
  const merged = { ...traceFields, ...(context ?? {}) };
  const entry: LogEntry = {
    id: nextId++,
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(Object.keys(merged).length > 0 ? { context: merged } : {}),
  };

  logBuffer.push(entry);

  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE);
  }

  if (logListener) {
    logListener(entry);
  }
}

/** Return a shallow copy of the in-memory log buffer. */
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

/** Clear all entries from the in-memory log buffer. */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/** Register (or unregister) a callback that receives every new log entry in real time. */
export function setLogListener(listener: ((entry: LogEntry) => void) | null): void {
  logListener = listener;
}

function formatCtx(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  return (
    " " +
    Object.entries(ctx)
      .map(([k, v]) => `${k}="${String(v)}"`)
      .join(" ")
  );
}

function writeStderr(line: string): void {
  process.stderr.write(`${line}\n`);
}

export interface ContextualLogger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  success(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
}

/**
 * Build a logger pre-tagged with `layer` + `source`. The factory's tags always
 * win over caller-supplied context (treat `layer`/`source` as authoritative
 * server-side metadata).
 */
export function createLogger(opts: { layer: LogLayer; source: string }): ContextualLogger {
  const tag = (ctx?: Record<string, unknown>): Record<string, unknown> => ({
    ...(ctx ?? {}),
    layer: opts.layer,
    source: opts.source,
  });
  return {
    info: (msg, ctx) => logger.info(msg, tag(ctx)),
    warn: (msg, ctx) => logger.warn(msg, tag(ctx)),
    error: (msg, ctx) => logger.error(msg, tag(ctx)),
    success: (msg, ctx) => logger.success(msg, tag(ctx)),
    debug: (msg, ctx) => logger.debug(msg, tag(ctx)),
  };
}

export const logger = {
  info(msg: string, ctx?: Record<string, unknown>): void {
    appendToBuffer("info", msg, ctx);
    writeStderr(`[INFO] ${msg}${formatCtx(ctx)}`);
  },
  warn(msg: string, ctx?: Record<string, unknown>): void {
    const normalized = extractErrorContext(ctx);
    appendToBuffer("warn", msg, normalized);
    writeStderr(`[WARN] ${msg}${formatCtx(normalized)}`);
  },
  error(msg: string, ctx?: Record<string, unknown>): void {
    const normalized = extractErrorContext(ctx);
    appendToBuffer("error", msg, normalized);
    writeStderr(`[ERROR] ${msg}${formatCtx(normalized)}`);
  },
  success(msg: string, ctx?: Record<string, unknown>): void {
    appendToBuffer("success", msg, ctx);
    writeStderr(`[OK] ${msg}${formatCtx(ctx)}`);
  },
  debug(msg: string, ctx?: Record<string, unknown>): void {
    if (process.env.MCP_GRAPH_DEBUG) {
      appendToBuffer("debug", msg, ctx);
      writeStderr(`[DEBUG] ${msg}${formatCtx(ctx)}`);
    }
  },
  event(event: BusinessEvent, msg: string, ctx?: Record<string, unknown>): void {
    const normalized = extractErrorContext(ctx) ?? {};
    const merged: Record<string, unknown> = {
      ...normalized,
      eventAction: event.action,
      eventCategory: event.category,
      eventOutcome: event.outcome,
    };
    appendToBuffer("info", msg, merged);
    writeStderr(`[INFO] ${msg}${formatCtx(merged)}`);
  },
};
