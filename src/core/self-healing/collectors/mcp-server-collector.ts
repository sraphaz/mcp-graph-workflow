/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: collector source=mcp_server
 *
 * Installs a process.on('uncaughtException') handler that enqueues a
 * FailureSignal and then re-throws to preserve Node.js default exit behaviour.
 */

import type { FailureSignalCollector } from "../failure-signal-collector.js";

export function installUncaughtExceptionCollector(collector: FailureSignalCollector): void {
  process.on("uncaughtException", (err: Error) => {
    collector.record({
      source: "mcp_server",
      signalKind: "uncaught_exception",
      context: {},
      severity: "critical",
      timestamp: new Date().toISOString(),
      rawError: err.message,
    });
    // Flush synchronously — process is about to exit
    collector.flush();
  });
}
