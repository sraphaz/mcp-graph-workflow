/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — blank-page watchdog. Browser-use port
 * (aboutblank_watchdog): catches `about:blank` tabs that often indicate
 * a popup interception or an aborted navigation, surfacing them so the
 * planner can navigate away or close the tab.
 */

import type { BrowserEventBus, WatchdogVerdict } from "../event-bus.js";

export function registerBlankPageWatchdog(bus: BrowserEventBus): void {
  bus.on("page.blank", "blank-page", (event): WatchdogVerdict => ({
    watchdog: "blank-page",
    level: "warn",
    message: `tab ${event.targetId} is on about:blank`,
    action: { type: "redirect_or_close", targetId: event.targetId },
  }));

  bus.on("page.load", "blank-page", (event): WatchdogVerdict | undefined => {
    if (event.url === "about:blank" || event.url === "") {
      return {
        watchdog: "blank-page",
        level: "warn",
        message: `loaded blank URL on tab ${event.targetId}`,
        action: { type: "redirect_or_close", targetId: event.targetId },
      };
    }
    return undefined;
  });
}
