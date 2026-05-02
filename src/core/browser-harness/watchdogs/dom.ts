/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — DOM watchdog. Browser-use port:
 * surfaces large DOM mutations (likely SPA route changes or content
 * floods) so the planner can re-snapshot before the next action.
 */

import type { BrowserEventBus, WatchdogVerdict } from "../event-bus.js";

export interface DomWatchdogOptions {
  /** Threshold of added nodes that triggers a `warn` verdict. */
  largeMutationThreshold?: number;
}

/** registerDomWatchdog — auto-generated description placeholder. */
export function registerDomWatchdog(bus: BrowserEventBus, opts: DomWatchdogOptions = {}): void {
  const threshold = opts.largeMutationThreshold ?? 50;

  bus.on("dom.mutation", "dom", (event): WatchdogVerdict | undefined => {
    if (event.addedNodes >= threshold) {
      return {
        watchdog: "dom",
        level: "warn",
        message: `large DOM mutation: ${event.addedNodes} added nodes (threshold ${threshold})`,
        action: { type: "request_resnapshot" },
      };
    }
    return undefined;
  });
}
