/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { CommandHandler, CommandHandlerArgs } from "../../commands/registry.js";
import { logEvent } from "./structured-logger.js";

/**
 * Wraps a command handler so every invocation emits a single structured
 * entry to `~/.mcp-graph/logs/cli.jsonl` with start/end timing and outcome.
 *
 * The wrapped handler is a drop-in replacement for the original — same
 * signature, same return shape. Errors are re-thrown after logging so the
 * caller's error path still runs.
 */
export function withCommandTrace(
  id: string,
  handler: CommandHandler,
): CommandHandler {
  return async (ctx: CommandHandlerArgs) => {
    const start = Date.now();
    try {
      const result = await handler(ctx);
      logEvent("cli", {
        source: "cli",
        actor: process.env.USER ?? "user",
        action: id,
        duration_ms: Date.now() - start,
        outcome: result.exitCode === 0 ? "ok" : "warn",
        ctx: {
          mode: ctx.mode,
          exitCode: result.exitCode ?? 0,
          flags: summarizeFlags(ctx.flags),
        },
        trace_id: ctx.traceId,
      });
      return result;
    } catch (err) {
      logEvent("cli", {
        source: "cli",
        actor: process.env.USER ?? "user",
        action: id,
        duration_ms: Date.now() - start,
        outcome: "error",
        ctx: {
          mode: ctx.mode,
          error: err instanceof Error ? err.message : String(err),
          flags: summarizeFlags(ctx.flags),
        },
        trace_id: ctx.traceId,
      });
      throw err;
    }
  };
}

function summarizeFlags(
  flags: Record<string, string | boolean>,
): Record<string, string | boolean> {
  // Don't log full flag values — they may contain secrets, file paths, etc.
  // Just record which flags were passed.
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.length > 64 ? `<len=${v.length}>` : v;
  }
  return out;
}
