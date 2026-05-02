/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — popups watchdog. Browser-use port:
 * auto-handles JavaScript dialogs (alert/confirm/prompt/beforeunload)
 * so a runaway popup never deadlocks the session.
 */

import type { BrowserEventBus, WatchdogVerdict } from "../event-bus.js";

/** registerPopupsWatchdog — auto-generated description placeholder. */
export function registerPopupsWatchdog(bus: BrowserEventBus): void {
  bus.on("dialog.open", "popups", (event): WatchdogVerdict => {
    // alert / confirm / beforeunload → accept; prompt → cancel (no input source).
    const accept = event.dialogType !== "prompt";
    return {
      watchdog: "popups",
      level: "info",
      message: `[${event.dialogType}] ${event.message.slice(0, 100)}`,
      action: { type: "handle_dialog", accept },
    };
  });
}
