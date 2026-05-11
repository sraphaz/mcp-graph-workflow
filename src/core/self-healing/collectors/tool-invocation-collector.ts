/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: collector source=tool_invocation
 *
 * Intercepts MCP tool results with isError:true and enqueues a FailureSignal.
 * Called from unified-gate.ts after handler execution.
 */

import type { FailureSignalCollector } from "../failure-signal-collector.js";

interface ToolCallResult {
  content: unknown[];
  isError?: boolean;
}

export function collectToolInvocationError(
  result: ToolCallResult,
  toolName: string,
  collector: FailureSignalCollector,
): void {
  if (!result.isError) return;
  collector.record({
    source: "tool_invocation",
    signalKind: "tool_isError",
    context: { toolName },
    severity: "error",
    timestamp: new Date().toISOString(),
  });
}
