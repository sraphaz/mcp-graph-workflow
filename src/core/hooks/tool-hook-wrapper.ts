/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { HookBus } from "./hook-bus.js";

type AnyHandler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * Wraps a tool handler to emit tool:pre-call before and tool:post-call after execution.
 * The wrapper is a pass-through: it preserves the handler return value and re-throws errors.
 * tool_token_usage telemetry is untouched — that runs in unified-gate.ts independently.
 */
export function withToolHooks(toolName: string, handler: AnyHandler, hookBus: HookBus): AnyHandler {
  return async (args: Record<string, unknown>): Promise<unknown> => {
    const timestamp = new Date().toISOString();

    await hookBus.emit({ channel: "tool:pre-call", timestamp, payload: { toolName, args } });

    const startedAt = Date.now();
    let error: string | undefined;

    try {
      const resultValue = await handler(args);
      return resultValue;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Date.now() - startedAt;
      await hookBus.emit({
        channel: "tool:post-call",
        timestamp: new Date().toISOString(),
        payload: { toolName, durationMs, ...(error !== undefined ? { error } : {}) },
      });
    }
  };
}
