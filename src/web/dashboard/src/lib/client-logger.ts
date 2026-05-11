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

type LogLevel = "info" | "warn" | "error" | "debug";

interface ClientLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface ClientLoggerOptions {
  ingestUrl: string;
  flushIntervalMs: number;
  maxBuffer: number;
}

export interface ClientLogger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
  reportError(err: Error, ctx?: Record<string, unknown>): void;
  installGlobalHandlers(): void;
  flush(): void;
  destroy(): void;
  newSpan(): string;
  getTraceId(): string;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function createClientLogger(opts: ClientLoggerOptions): ClientLogger {
  const buffer: ClientLogEntry[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  const sessionTraceId = randomId();
  let currentSpanId = randomId();

  function enqueue(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
    const traceCtx: Record<string, unknown> = { "trace.id": sessionTraceId, "span.id": currentSpanId };
    buffer.push({ level, message: msg, timestamp: new Date().toISOString(), context: { ...traceCtx, ...(ctx ?? {}) } });
    if (buffer.length >= opts.maxBuffer) {
      send();
    }
  }

  function send(): void {
    if (buffer.length === 0) return;
    const entries = buffer.splice(0, buffer.length);
    const blob = new Blob([JSON.stringify({ entries })], { type: "application/json" });
    navigator.sendBeacon(opts.ingestUrl, blob);
  }

  timer = setInterval(send, opts.flushIntervalMs);

  const onError = (event: ErrorEvent): void => {
    const err = event.error instanceof Error ? event.error : new Error(event.message);
    const ctx: Record<string, unknown> = {
      errorType: err.constructor.name,
      errorStack: err.stack ?? "",
      filename: event.filename,
      lineno: event.lineno,
    };
    enqueue("error", err.message || event.message, ctx);
    send();
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const ctx: Record<string, unknown> = {
      errorType: err.constructor.name,
      errorStack: err.stack ?? "",
    };
    enqueue("error", err.message, ctx);
    send();
  };

  return {
    info: (msg, ctx) => enqueue("info", msg, ctx),
    warn: (msg, ctx) => enqueue("warn", msg, ctx),
    error: (msg, ctx) => enqueue("error", msg, ctx),
    debug: (msg, ctx) => enqueue("debug", msg, ctx),

    reportError(err: Error, ctx?: Record<string, unknown>): void {
      const errorCtx: Record<string, unknown> = {
        ...ctx,
        errorType: err.constructor.name,
        errorStack: err.stack ?? "",
      };
      enqueue("error", err.message, errorCtx);
      send();
    },

    installGlobalHandlers(): void {
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onUnhandledRejection);
    },

    flush(): void {
      send();
    },

    destroy(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    },

    newSpan(): string {
      currentSpanId = randomId();
      return currentSpanId;
    },

    getTraceId(): string {
      return sessionTraceId;
    },
  };
}

const DEFAULT_INGEST_URL = "/api/v1/logs/ingest";

export const clientLogger = createClientLogger({
  ingestUrl: DEFAULT_INGEST_URL,
  flushIntervalMs: 5_000,
  maxBuffer: 50,
});
