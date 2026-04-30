/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — security watchdog. Browser-use port:
 * blocks navigations to disallowed origins, complementing the static
 * `allowedDomains` config in browser-pilot with a runtime gate.
 */

import type { BrowserEventBus, WatchdogVerdict } from "../event-bus.js";

export interface SecurityWatchdogOptions {
  /** Allow-list of origin substrings (e.g. "example.com"). Empty = allow all. */
  allowedOrigins?: string[];
}

export function registerSecurityWatchdog(bus: BrowserEventBus, opts: SecurityWatchdogOptions = {}): void {
  const allowed = (opts.allowedOrigins ?? []).map((s) => s.toLowerCase());

  bus.on("navigation.cross_origin", "security", (event): WatchdogVerdict => {
    if (allowed.length === 0) {
      return {
        watchdog: "security",
        level: "info",
        message: `cross-origin nav: ${event.fromOrigin} → ${event.toOrigin}`,
      };
    }
    const target = event.toOrigin.toLowerCase();
    const ok = allowed.some((a) => target.includes(a));
    if (!ok) {
      return {
        watchdog: "security",
        level: "block",
        message: `blocked cross-origin nav to ${event.toOrigin} (not in allow-list)`,
        action: { type: "abort_navigation" },
      };
    }
    return {
      watchdog: "security",
      level: "info",
      message: `allowed cross-origin nav: ${event.fromOrigin} → ${event.toOrigin}`,
    };
  });
}
